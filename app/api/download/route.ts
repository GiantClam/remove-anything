import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";
import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { Hashids } from "@/lib/hashid";
import { kv, KVRateLimit } from "@/lib/kv";
import {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "@/lib/analytics-events";
import { emitServerAnalyticsEvent } from "@/lib/server-analytics-events";
import {
  readLimitedResponse,
  ResultSizeLimitError,
} from "@/lib/limited-response";
import {
  LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX,
  materializeImageOutput,
  materializeImageZipOutput,
  UnsupportedOutputFormatError,
} from "@/lib/low-resolution-output";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { fetchTaskOutputByKey } from "@/lib/r2-s3";
import {
  assertTaskDownloadAccess,
  getTaskPrincipalFromRequest,
  TaskLifecycleError,
} from "@/lib/task-lifecycle";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import {
  assertOutputEntitlement,
  getRequestedOutputTier,
  OutputEntitlementError,
} from "@/lib/output-entitlements";
import { createProjectAuthProvider } from "@/modules/auth/adapter";

import {
  createBindingsFromRequest,
  isCloudflareRequest,
} from "../_cloudflare-adapter";

const TaskHashids = Hashids("Task");

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "5s",
});

function getKey(id: string) {
  return `download:${id}`;
}

const DownloadSchema = z.object({
  taskId: z.string(),
});

async function emitResultDownloaded(
  taskId: number | string,
  toolSlug: string,
  isAuthenticated: boolean,
) {
  try {
    await emitServerAnalyticsEvent(
      createTaskAnalyticsEvent(ANALYTICS_EVENTS.resultDownloaded, taskId, {
        tool_slug: toolSlug,
        is_authenticated: isAuthenticated,
      }),
    );
  } catch (error) {
    // Analytics delivery must never turn an authorized attachment into a
    // failed download. The stable event id allows a later sink retry.
    console.warn("Download analytics failed:", error);
  }
}

function isSupportedVideoPayload(bytes: Uint8Array, contentType: string) {
  if (contentType === "video/webm") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  }
  // MP4 metadata normally starts with an ISO-BMFF `ftyp` box. Search only a
  // small prefix so validation stays bounded and does not scan the payload.
  const prefix = Buffer.from(bytes.subarray(0, 64)).toString("ascii");
  return prefix.includes("ftyp");
}

// 包装函数以匹配适配器期望的类型
const getCurrentUser = async () => {
  const user = await getCurrentUserOriginal();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  };
};

export async function GET(req: NextRequest) {
  const auth = createProjectAuthProvider(getCurrentUser);
  const user = await auth.getCurrentUser();
  const { userId, principalId } = getTaskPrincipalFromRequest(
    req,
    user?.userId,
  );
  if (!userId && !principalId)
    return NextResponse.json(
      { error: "Not authenticated", code: "ANONYMOUS_PRINCIPAL_REQUIRED" },
      { status: 401 },
    );

  // 使用 Cloudflare 绑定或回退到环境变量
  let rateLimiter = ratelimit;
  if (isCloudflareRequest(req)) {
    const { kv: cfKV } = createBindingsFromRequest(req);
    rateLimiter = new KVRateLimit(cfKV, {
      limit: 10,
      window: "5s",
    });
    console.log("🌐 API Route: 使用Cloudflare KV绑定进行速率限制");
  }

  const { success } = await rateLimiter.limit(
    getKey(userId || principalId || "anonymous") + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    const type = url.searchParams.get("type");
    const preview = url.searchParams.get("preview") === "1";
    const outputTier = getRequestedOutputTier(url.searchParams.get("output"));

    // 处理去水印任务下载
    if (type === "watermark-removal" && taskId) {
      const watermarkTask = await prisma.watermarkRemovalTask.findUnique({
        where: {
          runninghubTaskId: taskId,
        },
      });

      if (!watermarkTask || !watermarkTask.outputZipUrl) {
        return new Response("Not found", { status: 404 });
      }

      const entitlement = assertOutputEntitlement({
        toolSlug: "remove-watermark",
        requestedTier: outputTier,
        userId,
      });

      try {
        assertTaskDownloadAccess(watermarkTask, { userId, principalId });
      } catch (error) {
        if (error instanceof TaskLifecycleError)
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status },
          );
        throw error;
      }

      // Fetch the file from the URL (may be zip or image)
      const r2Key = getR2ObjectKey(watermarkTask.outputZipUrl, env.R2_URL_BASE);
      if (!r2Key) {
        return NextResponse.json(
          {
            error:
              "Result is awaiting secure storage. Refresh the task to retry.",
            code: "RESULT_MIGRATION_REQUIRED",
          },
          { status: 409 },
        );
      }
      const fileResponse = await fetchTaskOutputByKey(r2Key, 60);
      if (!fileResponse.ok) {
        return new Response("File not found", { status: 404 });
      }

      const contentType =
        fileResponse.headers
          .get("content-type")
          ?.split(";", 1)[0]
          .trim()
          .toLowerCase() || "";
      if (
        ![
          "application/zip",
          "application/x-zip-compressed",
          "image/png",
          "image/jpeg",
          "image/webp",
        ].includes(contentType)
      ) {
        return NextResponse.json(
          { error: "Result is not a supported ZIP or image" },
          { status: 502 },
        );
      }
      const maxOutputBytes =
        getToolRegistryEntry("remove-watermark")!.limits.maxOutputSizeMb *
        1024 *
        1024;
      const uint8 = await readLimitedResponse(fileResponse, maxOutputBytes);
      const isZipMagic =
        uint8.length >= 4 &&
        uint8[0] === 0x50 &&
        uint8[1] === 0x4b &&
        ((uint8[2] === 0x03 && uint8[3] === 0x04) ||
          (uint8[2] === 0x05 && uint8[3] === 0x06));

      if (contentType.includes("zip")) {
        if (!isZipMagic)
          return NextResponse.json(
            { error: "Result is not a valid ZIP archive" },
            { status: 502 },
          );
        const packaged = await materializeImageZipOutput({
          tier: entitlement.tier,
          input: uint8,
          maxOutputBytes,
        });
        if (!preview)
          await emitResultDownloaded(
            watermarkTask.id,
            "remove-watermark",
            Boolean(userId),
          );
        return new Response(packaged.bytes, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="watermark-removed-${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip"`,
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
            ...(entitlement.tier === "preview"
              ? {
                  "X-Output-Max-Edge-Px": String(
                    LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX,
                  ),
                }
              : { "X-Output-Tier": "full" }),
            Vary: "Cookie, Authorization",
          },
        });
      }

      // Otherwise, materialize the image (preview downscale or full) then ZIP.
      const rendered = await materializeImageOutput({
        tier: entitlement.tier,
        input: uint8,
        contentType,
        maxOutputBytes,
      });
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const ext = rendered.contentType.split("/")[1];
      zip.file(`image_1.${ext}`, rendered.bytes);
      const zipped = await zip.generateAsync({ type: "arraybuffer" });
      if (zipped.byteLength > maxOutputBytes)
        throw new ResultSizeLimitError(maxOutputBytes);

      if (!preview)
        await emitResultDownloaded(
          watermarkTask.id,
          "remove-watermark",
          Boolean(userId),
        );

      return new Response(zipped, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="watermark-removed-${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip"`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          ...(entitlement.tier === "preview"
            ? {
                "X-Output-Max-Edge-Px": String(LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX),
              }
            : { "X-Output-Tier": "full" }),
          Vary: "Cookie, Authorization",
        },
      });
    }

    // 处理 Sora2 视频去水印任务下载
    if (type === "sora2-video-watermark-removal" && taskId) {
      const sora2Task = await prisma.taskData.findFirst({
        where: {
          replicateId: taskId,
          model: "sora2-video-watermark-removal",
        },
      });

      if (!sora2Task || !sora2Task.imageUrl) {
        return new Response("Not found", { status: 404 });
      }

      try {
        assertTaskDownloadAccess(sora2Task, { userId, principalId });
      } catch (error) {
        if (error instanceof TaskLifecycleError)
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status },
          );
        throw error;
      }

      const entitlement = assertOutputEntitlement({
        toolSlug: "sora2-video-watermark-removal",
        requestedTier: outputTier,
        userId,
      });

      // Legacy Sora2 rows may still contain a provider/public URL. Never fetch
      // that URL from the download boundary: output access must go through the
      // private R2 migration first. This also prevents SSRF and public-bucket
      // bypasses for historical rows.
      const r2Key = getR2ObjectKey(sora2Task.imageUrl, env.R2_URL_BASE);
      if (!r2Key) {
        return NextResponse.json(
          {
            error:
              "Result is awaiting secure storage. Refresh the task to retry.",
            code: "RESULT_MIGRATION_REQUIRED",
          },
          { status: 409 },
        );
      }
      const videoResponse = await fetchTaskOutputByKey(r2Key, 60);
      if (!videoResponse.ok) {
        return new Response("Video not found", { status: 404 });
      }

      const contentType = videoResponse.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (contentType !== "video/mp4" && contentType !== "video/webm") {
        return NextResponse.json(
          { error: "Result is not a supported video" },
          { status: 502 },
        );
      }
      const maxOutputBytes =
        getToolRegistryEntry("sora2-video-watermark-removal")!.limits
          .maxOutputSizeMb *
        1024 *
        1024;
      const videoBuffer = await readLimitedResponse(
        videoResponse,
        maxOutputBytes,
      );
      if (!isSupportedVideoPayload(videoBuffer, contentType)) {
        return NextResponse.json(
          { error: "Result is not a valid supported video" },
          { status: 502 },
        );
      }
      const extension = contentType === "video/webm" ? "webm" : "mp4";
      const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");

      if (!preview)
        await emitResultDownloaded(
          sora2Task.id,
          "sora2-video-watermark-removal",
          Boolean(userId),
        );

      // Return the video with appropriate headers
      return new Response(videoBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="sora2-video-watermark-removed-${safeTaskId}.${extension}"`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          ...(entitlement.tier === "full" ? { "X-Output-Tier": "full" } : {}),
          Vary: "Cookie, Authorization",
        },
      });
    }

    // 处理任务下载（原有逻辑，保持对旧任务的兼容）
    if (!taskId) {
      return NextResponse.json(
        { error: "Missing taskId parameter" },
        { status: 400 },
      );
    }

    const [id] = TaskHashids.decode(taskId);
    if (!id) {
      return new Response("Not found", { status: 404 });
    }

    const taskData = await prisma.taskData.findUnique({
      where: {
        id: id as number,
      },
    });

    if (!taskData || !taskData.imageUrl) {
      return new Response("Not found", { status: 404 });
    }

    try {
      assertTaskDownloadAccess(taskData, { userId, principalId });
    } catch (error) {
      if (error instanceof TaskLifecycleError)
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      throw error;
    }

    const entitlement = assertOutputEntitlement({
      toolSlug: "remove-background",
      requestedTier: outputTier,
      userId,
    });

    // Historical TaskData rows may point to provider/public URLs. Keep the
    // legacy route compatible only for outputs already migrated to private R2.
    const r2Key = getR2ObjectKey(taskData.imageUrl, env.R2_URL_BASE);
    if (!r2Key) {
      return NextResponse.json(
        {
          error:
            "Result is awaiting secure storage. Refresh the task to retry.",
          code: "RESULT_MIGRATION_REQUIRED",
        },
        { status: 409 },
      );
    }
    const imageResponse = await fetchTaskOutputByKey(r2Key, 60);
    if (!imageResponse.ok) {
      return new Response("Image not found", { status: 404 });
    }

    const contentType = imageResponse.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (
      contentType !== "image/png" &&
      contentType !== "image/jpeg" &&
      contentType !== "image/webp"
    ) {
      return NextResponse.json(
        { error: "Result is not a supported image" },
        { status: 502 },
      );
    }
    const maxOutputBytes =
      getToolRegistryEntry("remove-background")!.limits.maxOutputSizeMb *
      1024 *
      1024;
    const sourceImage = await readLimitedResponse(
      imageResponse,
      maxOutputBytes,
    );
    const image = await materializeImageOutput({
      tier: entitlement.tier,
      input: sourceImage,
      contentType,
      maxOutputBytes,
    });

    // Guess extension from content-type or URL
    const ext =
      image.contentType === "image/jpeg"
        ? "jpg"
        : image.contentType.split("/")[1];
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (!preview)
      await emitResultDownloaded(
        taskData.id,
        "remove-background",
        Boolean(userId),
      );

    // Return the image with appropriate headers
    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="image-${safeTaskId}.${ext}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        ...(entitlement.tier === "preview"
          ? {
              "X-Output-Max-Edge-Px": String(LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX),
            }
          : { "X-Output-Tier": "full" }),
        Vary: "Cookie, Authorization",
      },
    });
  } catch (error) {
    if (error instanceof OutputEntitlementError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof UnsupportedOutputFormatError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    if (error instanceof ResultSizeLimitError) {
      return NextResponse.json(
        { error: error.message, code: "RESULT_TOO_LARGE" },
        { status: 413 },
      );
    }
    console.log("Download error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}

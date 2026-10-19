import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";
import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { Hashids } from "@/lib/hashid";
import { kv, KVRateLimit } from "@/lib/kv";
import {
  readLimitedResponse,
  ResultSizeLimitError,
} from "@/lib/limited-response";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { createR2S3Service } from "@/lib/r2-s3";
import {
  assertTaskDownloadAccess,
  getTaskPrincipalFromRequest,
  TaskLifecycleError,
} from "@/lib/task-lifecycle";
import { getToolRegistryEntry } from "@/lib/tool-registry";
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
      const sourceUrl = await createR2S3Service().getSignedUrl(
        r2Key,
        env.R2_BUCKET,
        60,
      );
      const fileResponse = await fetch(sourceUrl, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
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
        return new Response(uint8, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="watermark-removed-${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip"`,
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
            Vary: "Cookie, Authorization",
          },
        });
      }

      // Otherwise, wrap the file into a ZIP on-the-fly
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      // Guess extension from content-type or URL
      const fromContentType = contentType.split("/")[1] || "";
      const guessedExt = fromContentType ? fromContentType.split(";")[0] : "";
      const urlExtMatch = watermarkTask.outputZipUrl.match(
        /\.([a-zA-Z0-9]+)(?:\?|#|$)/,
      );
      const urlExt = urlExtMatch?.[1];
      const ext = (guessedExt || urlExt || "png").toLowerCase();
      zip.file(`image_1.${ext}`, uint8);
      const zipped = await zip.generateAsync({ type: "arraybuffer" });
      if (zipped.byteLength > maxOutputBytes)
        throw new ResultSizeLimitError(maxOutputBytes);

      return new Response(zipped, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="watermark-removed-${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip"`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
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

      // Fetch the video from the URL
      const videoResponse = await fetch(sora2Task.imageUrl);
      if (!videoResponse.ok) {
        return new Response("Video not found", { status: 404 });
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      const contentType =
        videoResponse.headers.get("content-type") || "video/mp4";

      // Return the video with appropriate headers
      return new Response(videoBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="sora2-video-watermark-removed-${taskId}.mp4"`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
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

    // Fetch the image from the URL
    const imageResponse = await fetch(taskData.imageUrl);
    if (!imageResponse.ok) {
      return new Response("Image not found", { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType =
      imageResponse.headers.get("content-type") || "image/png";

    // Guess extension from content-type or URL
    const fromContentType = contentType.split("/")[1] || "";
    const guessedExt = fromContentType ? fromContentType.split(";")[0] : "";
    const urlExtMatch = taskData.imageUrl.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    const urlExt = urlExtMatch?.[1];
    const ext = (guessedExt || urlExt || "png").toLowerCase();

    // Return the image with appropriate headers
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="image-${taskId}.${ext}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        Vary: "Cookie, Authorization",
      },
    });
  } catch (error) {
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

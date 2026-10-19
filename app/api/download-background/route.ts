import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import {
  findBackgroundRemovalTaskByReplicateId,
  incrementDownloadCount,
} from "@/db/queries/background-removal";
import { env } from "@/env.mjs";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
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

import {
  createBindingsFromRequest,
  isCloudflareRequest,
} from "../_cloudflare-adapter";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "5s",
});

function getKey(id: string) {
  return `download_bg:${id}`;
}

const DownloadSchema = z.object({
  taskId: z.string(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const { userId, principalId } = getTaskPrincipalFromRequest(req, user?.id);
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
    const preview = url.searchParams.get("preview") === "1";

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing taskId parameter" },
        { status: 400 },
      );
    }

    // 查找背景移除任务
    const taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);

    if (!taskRecord) {
      return new Response("Task not found", { status: 404 });
    }

    if (!taskRecord.outputImageUrl) {
      return new Response("Task not completed or failed", { status: 404 });
    }

    try {
      assertTaskDownloadAccess(taskRecord, { userId, principalId });
    } catch (error) {
      if (error instanceof TaskLifecycleError)
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      throw error;
    }

    // 获取图片
    const r2Key = getR2ObjectKey(taskRecord.outputImageUrl, env.R2_URL_BASE);
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
    const imageResponse = await fetch(sourceUrl, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!imageResponse.ok) {
      return new Response("Image not found", { status: 404 });
    }

    const contentType =
      imageResponse.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase() || "image/png";
    if (contentType !== "image/png")
      return NextResponse.json(
        { error: "Result is not a PNG image" },
        { status: 502 },
      );
    const imageBuffer = await readLimitedResponse(
      imageResponse,
      getToolRegistryEntry("remove-background")!.limits.maxOutputSizeMb *
        1024 *
        1024,
    );

    // 增加下载计数
    if (!preview) {
      try {
        await incrementDownloadCount(taskRecord.id);
      } catch (countError) {
        console.warn("Failed to increment download count:", countError);
        // 不阻断下载流程
      }
    }

    // 返回图片文件
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="background-removed-${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}.png"`,
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
    console.error("Download background error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

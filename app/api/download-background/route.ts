import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { z } from "zod";
import { findBackgroundRemovalTaskByReplicateId, incrementDownloadCount } from "@/db/queries/background-removal";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { createBindingsFromRequest, isCloudflareRequest } from "../_cloudflare-adapter";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "5s"
});

function getKey(id: string) {
  return `download_bg:${id}`;
}

const DownloadSchema = z.object({
  taskId: z.string(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;

  // 使用 Cloudflare 绑定或回退到环境变量
  let rateLimiter = ratelimit;
  if (isCloudflareRequest(req)) {
    const { kv: cfKV } = createBindingsFromRequest(req);
    rateLimiter = new KVRateLimit(cfKV, {
      limit: 10,
      window: "5s"
    });
    console.log('🌐 API Route: 使用Cloudflare KV绑定进行速率限制');
  }

  const { success } = await rateLimiter.limit(
    getKey(userId) + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    
    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId parameter" }, { status: 400 });
    }

    // 查找背景移除任务
    const taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
    
    if (!taskRecord) {
      return new Response("Task not found", { status: 404 });
    }

    if (!taskRecord.outputImageUrl) {
      return new Response("Task not completed or failed", { status: 404 });
    }

    // 检查用户权限：
    // 1. 匿名任务（userId为null）允许任何登录用户下载
    // 2. 用户拥有的任务只能自己下载
    if (taskRecord.userId && taskRecord.userId !== userId) {
      return new Response("Forbidden", { status: 403 });
    }

    // 增加下载计数
    try {
      await incrementDownloadCount(taskRecord.id);
    } catch (countError) {
      console.warn("Failed to increment download count:", countError);
      // 不阻断下载流程
    }

    // 获取图片
    const imageResponse = await fetch(taskRecord.outputImageUrl);
    if (!imageResponse.ok) {
      return new Response("Image not found", { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/png";
    
    // 返回图片文件
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="background-removed-${taskId}.png"`,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Download background error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

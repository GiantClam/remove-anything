import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { z } from "zod";

import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma } from "@/db/prisma";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { createBindingsFromRequest, isCloudflareRequest } from "../_cloudflare-adapter";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "5s"
});

function getKey(id: string) {
  return `download:${id}`;
}

const DownloadSchema = z.object({
  fluxId: z.string(),
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
    const fluxId = url.searchParams.get("fluxId");
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

      // Check if user owns this task or if it's public
      if (watermarkTask.userId !== userId && watermarkTask.isPublic === false) {
        return new Response("Forbidden", { status: 403 });
      }

      // Fetch the file from the URL (may be zip or image)
      const fileResponse = await fetch(watermarkTask.outputZipUrl);
      if (!fileResponse.ok) {
        return new Response("File not found", { status: 404 });
      }

      const contentType = fileResponse.headers.get("content-type") || "";

      const downloadedArrayBuffer = await fileResponse.arrayBuffer();
      const uint8 = new Uint8Array(downloadedArrayBuffer);
      const isZipMagic = uint8.length >= 2 && uint8[0] === 0x50 && uint8[1] === 0x4b;

      if (contentType.includes("zip") && isZipMagic) {
        return new Response(downloadedArrayBuffer, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="watermark-removed-${taskId}.zip"`,
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      // Otherwise, wrap the file into a ZIP on-the-fly
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      // Guess extension from content-type or URL
      const fromContentType = contentType.split("/")[1] || "";
      const guessedExt = fromContentType ? fromContentType.split(";")[0] : "";
      const urlExtMatch = watermarkTask.outputZipUrl.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
      const urlExt = urlExtMatch?.[1];
      const ext = (guessedExt || urlExt || "png").toLowerCase();
      zip.file(`image_1.${ext}`, downloadedArrayBuffer);
      const zipped = await zip.generateAsync({ type: "arraybuffer" });

      return new Response(zipped, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="watermark-removed-${taskId}.zip"`,
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    
    // 处理 Flux 任务下载（原有逻辑）
    if (!fluxId) {
      return NextResponse.json({ error: "Missing fluxId parameter" }, { status: 400 });
    }

    const [id] = FluxHashids.decode(fluxId);
    if (!id) {
      return new Response("Not found", { status: 404 });
    }

    const fluxData = await prisma.fluxData.findUnique({
      where: {
        id: id as number,
      },
    });

    if (!fluxData || !fluxData.imageUrl) {
      return new Response("Not found", { status: 404 });
    }

    // Check if user owns this flux or if it's public
    if (fluxData.userId !== userId && fluxData.isPrivate) {
      return new Response("Forbidden", { status: 403 });
    }

    // Fetch the image from the URL
    const imageResponse = await fetch(fluxData.imageUrl);
    if (!imageResponse.ok) {
      return new Response("Image not found", { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    
    // Return the image with appropriate headers
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="flux-${fluxId}.jpg"`,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.log("Download error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
} 
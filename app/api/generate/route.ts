import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "10s"
});

function getKey(id: string) {
  return `generate:${id}`;
}

export const maxDuration = 60;

type Params = { params: { key: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  const userId = user?.id || "anonymous"; // 允许匿名用户

  const { success } = await ratelimit.limit(
    getKey(userId) + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    // 检查Content-Type，支持FormData和JSON两种格式
    const contentType = req.headers.get('content-type') || '';
    
    let imageUrl: string;
    
    if (contentType.includes('multipart/form-data')) {
      // 处理FormData格式
      const formData = await req.formData();
      const image = formData.get('image') as File;
      
      if (!image) {
        return NextResponse.json({ error: "No image provided" }, { status: 400 });
      }

      // 这里需要将文件上传到某个地方获取URL
      // 暂时使用一个示例URL，实际应该上传到R2或其他存储服务
      console.log("⚠️ 开发模式：跳过文件上传，使用示例URL");
      imageUrl = "https://example.com/sample-image.jpg"; // 示例URL
    } else {
      // 处理JSON格式
      const data = await req.json();
      imageUrl = data.image || data.inputImageUrl;
      
      if (!imageUrl) {
        return NextResponse.json({ error: "No image URL provided" }, { status: 400 });
      }
    }

    // 调用AI Gateway进行背景移除
    try {
      console.log("🚀 开始调用 Cloudflare AI Gateway + Replicate 进行背景移除...");
      
      const result = await aiGateway.removeBackground({
        image: imageUrl,
        resolution: "", // 使用默认分辨率
      });

      if (result.error) {
        return NextResponse.json(
          { error: result.error || "Background removal failed" },
          { status: 400 },
        );
      }

      console.log('✅ AI Gateway 调用成功，结果:', result);

      // 返回处理结果
      return NextResponse.json({ 
        success: true,
        data: {
          url: result.output || imageUrl, // 返回处理后的图片URL
        }
      });
    } catch (aiError) {
      console.error("AI Gateway 调用失败:", aiError);
      throw aiError;
    }
  } catch (error) {
    console.log("error-->", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}

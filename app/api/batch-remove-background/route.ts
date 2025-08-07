import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";

const ratelimit = new KVRateLimit(kv, {
  limit: 5,
  window: "10s"
});

function getKey(id: string) {
  return `batch-remove-background:${id}`;
}

export const maxDuration = 300; // 5分钟超时

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;

  const { success } = await ratelimit.limit(
    getKey(user.id) + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const data = await req.json();
    const { imageUrls } = data;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0 || imageUrls.length > 10) {
      return NextResponse.json({ error: "Invalid image URLs array (1-10 images required)" }, { status: 400 });
    }

    // 验证所有URL
    for (const url of imageUrls) {
      if (typeof url !== 'string' || !url.startsWith('http')) {
        return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
      }
    }

    console.log(`🚀 开始批量背景移除处理，共 ${imageUrls.length} 张图片`);

    // 异步处理每张图片的背景去除
    const processPromises = imageUrls.map(async (imageUrl: string, index: number) => {
      try {
        console.log(`🚀 开始处理第 ${index + 1} 张图片的背景去除...`);
        
        // 调用 AI Gateway 进行背景去除
        const result = await aiGateway.removeBackground({
          image: imageUrl,
          resolution: "", // 使用默认分辨率
        });

        if (result.error) {
          throw new Error(result.error);
        }

        console.log(`✅ 第 ${index + 1} 张图片背景去除完成`);
        return { 
          success: true, 
          index, 
          originalImageUrl: imageUrl,
          processedImageUrl: result.output 
        };

      } catch (error) {
        console.error(`❌ 第 ${index + 1} 张图片背景去除失败:`, error);
        return { 
          success: false, 
          index, 
          originalImageUrl: imageUrl,
          error: getErrorMessage(error) 
        };
      }
    });

    // 等待所有图片处理完成
    const results = await Promise.allSettled(processPromises);
    
    // 处理结果
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { 
          success: false, 
          index, 
          originalImageUrl: imageUrls[index],
          error: getErrorMessage(result.reason) 
        };
      }
    });
    
    const completedCount = processedResults.filter(r => r.success).length;
    const failedCount = imageUrls.length - completedCount;
    
    console.log(`✅ 批量背景移除完成: ${completedCount} 成功, ${failedCount} 失败`);

    return NextResponse.json({
      success: true,
      totalImages: imageUrls.length,
      completedImages: completedCount,
      failedImages: failedCount,
      results: processedResults,
    });

  } catch (error) {
    console.error("❌ 批量背景去除处理错误:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
} 
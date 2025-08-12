import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";
import { createBackgroundRemovalTask } from "@/db/queries/background-removal";
import { getUserCredit } from "@/db/queries/account";
import { prisma } from "@/db/prisma";
import { Credits, model } from "@/config/constants";
import { BillingType } from "@/db/type";

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

    if (!Array.isArray(imageUrls) || imageUrls.length === 0 || imageUrls.length > 50) {
      return NextResponse.json({ error: "Invalid image URLs array (1-50 images required)" }, { status: 400 });
    }

    // 验证所有URL
    for (const url of imageUrls) {
      if (typeof url !== 'string' || !url.startsWith('http')) {
        return NextResponse.json({ error: "Invalid image URL format" }, { status: 400 });
      }
    }

    // 检查图片总大小（可选，如果需要严格控制）
    let totalSize = 0;
    const maxTotalSize = 100 * 1024 * 1024; // 100MB
    
    for (const url of imageUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          totalSize += parseInt(contentLength, 10);
          if (totalSize > maxTotalSize) {
            return NextResponse.json({ 
              error: `Total image size exceeds 100MB limit. Current total: ${Math.round(totalSize / 1024 / 1024)}MB` 
            }, { status: 400 });
          }
        }
      } catch (sizeError) {
        console.warn(`Failed to check size for ${url}:`, sizeError);
        // 继续处理，不阻断流程
      }
    }

    // 检查用户积分
    const requiredCredits = Credits[model.backgroundRemoval] * imageUrls.length;
    try {
      const userCredit = await getUserCredit(userId);
      if (userCredit.credit < requiredCredits) {
        return NextResponse.json(
          { error: "Insufficient credits", requiredCredits, currentCredits: userCredit.credit },
          { status: 402 }
        );
      }
    } catch (error) {
      console.error("❌ 获取用户积分失败:", error);
      return NextResponse.json({ error: "Failed to check user credits" }, { status: 500 });
    }

    console.log(`🚀 开始批量背景移除处理，共 ${imageUrls.length} 张图片，需要 ${requiredCredits} 积分`);

    // 异步处理每张图片的背景去除
    const processPromises = imageUrls.map(async (imageUrl: string, index: number) => {
      try {
        console.log(`🚀 开始处理第 ${index + 1} 张图片的背景去除...`);
        
        // 使用异步API调用 AI Gateway 进行背景去除
        const result = await aiGateway.removeBackgroundAsync({
          image: imageUrl,
          resolution: "1024x1024",
        });

        if (result.error) {
          throw new Error(result.error);
        }

        // 创建任务记录
        const taskRecord = await createBackgroundRemovalTask({
          userId: userId,
          replicateId: result.id,
          inputImageUrl: imageUrl,
          resolution: "1024x1024",
          model: "men1scus/birefnet"
        });

        console.log(`✅ 第 ${index + 1} 张图片异步任务创建成功:`, result.id);
        return { 
          success: true, 
          index, 
          originalImageUrl: imageUrl,
          replicateId: result.id,
          taskRecordId: taskRecord.id
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
    
    // 只为成功的任务扣费
    if (completedCount > 0) {
      try {
        const creditsToDeduct = Credits[model.backgroundRemoval] * completedCount;
        await prisma.$transaction(async (tx) => {
          const userCredit = await tx.userCredit.findFirst({ where: { userId } });
          const newCreditBalance = userCredit.credit - creditsToDeduct;
          
          await tx.userCredit.update({ 
            where: { id: userCredit.id }, 
            data: { credit: newCreditBalance } 
          });
          
          const billing = await tx.userBilling.create({
            data: { 
              userId, 
              state: "Done", 
              amount: creditsToDeduct, 
              type: BillingType.Withdraw, 
              description: `Batch Background Removal - ${completedCount} images` 
            },
          });
          
          await tx.userCreditTransaction.create({
            data: { 
              userId, 
              credit: -creditsToDeduct, 
              balance: newCreditBalance, 
              billingId: billing.id, 
              type: "Batch Background Removal" 
            },
          });
        });
        
        console.log(`✅ 用户 ${userId} 成功扣除 ${creditsToDeduct} 积分（${completedCount} 张图片）`);
      } catch (error) {
        console.error("❌ 批量扣费失败:", error);
        // 不阻断返回结果，但记录错误
      }
    }
    
    console.log(`✅ 批量背景移除完成: ${completedCount} 成功, ${failedCount} 失败`);

    return NextResponse.json({
      success: true,
      totalImages: imageUrls.length,
      completedImages: completedCount,
      failedImages: failedCount,
      results: processedResults.map(result => ({
        ...result,
        id: result.replicateId || `failed-${result.index}` // 为前端提供ID
      })),
    });

  } catch (error) {
    console.error("❌ 批量背景去除处理错误:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
} 
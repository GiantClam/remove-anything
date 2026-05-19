import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { nanoid } from "nanoid";

import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
// import { aiGateway } from "@/lib/ai-gateway"; // 切换到 RunningHub
import { env } from "@/env.mjs";
import crypto from 'crypto';
import { createBackgroundRemovalTask } from "@/db/queries/background-removal";
import { getUserCredit } from "@/db/queries/account";
import { prisma } from "@/db/prisma";
import { Credits, model } from "@/config/constants";
import { BillingType } from "@/db/type";
import { createRunningHubClient } from "@/modules/runninghub";
import { createR2S3Service } from "@/lib/r2-s3";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "10s"
});

function getKey(id: string) {
  return `generate:${id}`;
}

export const maxDuration = 60;

// 简化的文件上传到R2的函数
async function uploadToR2(file: File): Promise<string> {
  let uploadKey = "";
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log("📤 开始上传文件到R2...");
    }
    
    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `${nanoid(12)}.${fileExtension}`;
    const key = `background-removal/${filename}`;
    uploadKey = key;
    
    // 转换文件为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const s3Client = createR2S3Service();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log("文件大小:", buffer.length, "bytes");
      console.log("文件类型:", file.type);
      console.log("上传键:", key);
    }
    const result = await s3Client.putItemInBucket(filename, buffer, {
      path: "background-removal",
      ContentType: file.type,
      acl: "public-read",
    });
    
    const publicUrl = result.completedUrl;
    if (process.env.NODE_ENV !== 'production') {
      console.log("✅ 文件上传成功:", publicUrl);
      console.log("S3结果:", result);
    }
    
    return publicUrl;
  } catch (error: any) {
    console.error("❌ 文件上传失败:", error);
    
    // 如果是认证错误，提供更详细的调试信息（仅在非生产环境输出）
    if (error.code === 'SignatureDoesNotMatch' && process.env.NODE_ENV !== 'production') {
      console.error("🔍 R2认证调试信息:");
      console.error("- R2_ACCESS_KEY长度:", env.R2_ACCESS_KEY?.length);
      console.error("- R2_SECRET_KEY长度:", env.R2_SECRET_KEY?.length);
      console.error("- 上传目标键:", uploadKey);
    }
    
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const userId = user?.id || null; // 对于匿名用户，使用null而不是"anonymous"

  const { success } = await ratelimit.limit(
    getKey(userId || "anonymous") + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  // 对于登录用户，检查积分
  if (userId) {
    try {
      const userCredit = await getUserCredit(userId);
      const requiredCredits = Credits[model.backgroundRemoval] || 2;
      
      if (userCredit.credit < requiredCredits) {
        return NextResponse.json(
          { error: "Insufficient credits", requiredCredits, currentCredits: userCredit.credit },
          { status: 402 }
        );
      }
    } catch (error) {
      console.error("❌ 检查用户积分失败:", error);
      // 如果积分检查失败，仍然允许匿名用户继续，但记录错误
      if (userId) {
        return NextResponse.json(
          { error: "Failed to check user credits" },
          { status: 500 }
        );
      }
    }
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

      // 上传文件到R2
      try {
        imageUrl = await uploadToR2(image);
      } catch (uploadError) {
        console.error("❌ 文件上传失败:", uploadError);
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
      }
    } else {
      // 处理JSON格式
      const data = await req.json();
      imageUrl = data.image || data.inputImageUrl;
      
      if (!imageUrl) {
        return NextResponse.json({ error: "No image URL provided" }, { status: 400 });
      }
    }

    console.log("🚀 使用 RunningHub API 进行背景移除...");
    console.log("图片URL:", imageUrl);
    console.log("用户ID:", userId || "anonymous");

    const rh = createRunningHubClient();
    const workflowId = "1977998138864795650";
    const uploadNodeId = "233"; // image node

    let runninghubTaskId: string;
    try {
      runninghubTaskId = await rh.createTaskGeneric({
        workflowId,
        nodeInfoList: [
          { nodeId: uploadNodeId, fieldName: "image", fieldValue: imageUrl }
        ],
        taskRecordId: undefined, // 暂时不传，避免webhook问题
      });
    } catch (e: any) {
      console.error("❌ RunningHub 创建任务失败:", e);
      return NextResponse.json({ error: "Failed to create RunningHub task", details: e?.message || String(e) }, { status: 500 });
    }

    // 创建任务记录（沿用 replicateId 字段存储外部任务ID）
    const taskRecord = await createBackgroundRemovalTask({
      userId: userId || undefined,
      replicateId: runninghubTaskId,
      inputImageUrl: imageUrl,
      resolution: "1024x1024",
      model: "runninghub/background-removal"
    });

    console.log("✅ RunningHub 任务创建成功:", runninghubTaskId);
    console.log("✅ 任务记录创建成功:", taskRecord);

    // 启动任务状态监控
    try {
      const { taskQueueManager } = await import("@/lib/task-queue");
      taskQueueManager.startStatusWatcher(taskRecord.id, runninghubTaskId, 'background-removal');
      console.log("✅ 任务状态监控已启动");
    } catch (error) {
      console.error("❌ 启动任务状态监控失败:", error);
      // 不影响主流程，继续执行
    }

    // 对于登录用户，扣除积分并创建计费记录
    if (userId && taskRecord) {
      try {
        const requiredCredits = Credits[model.backgroundRemoval] || 2;
        
        // 开发模式：跳过积分扣除
        if (process.env.NODE_ENV === "development") {
          console.log(`🔧 开发模式：跳过用户 ${userId} 的积分扣除`);
        } else {
          await prisma.$transaction(async (tx) => {
            // 扣除用户积分
            const userCredit = await tx.userCredit.findFirst({
              where: { userId },
            });

            if (!userCredit || userCredit.credit < requiredCredits) {
              throw new Error("Insufficient credits");
            }

            const newCreditBalance = userCredit.credit - requiredCredits;
            
            await tx.userCredit.update({
              where: { id: userCredit.id },
              data: {
                credit: newCreditBalance,
              },
            });

            // 创建计费记录
            const billing = await tx.userBilling.create({
              data: {
                userId,
                state: "Done",
                amount: requiredCredits,
                type: BillingType.Withdraw,
                description: `Background Removal - Task ${runninghubTaskId}`,
              },
            });

            // 创建积分交易记录
            await tx.userCreditTransaction.create({
              data: {
                userId,
                credit: -requiredCredits,
                balance: newCreditBalance,
                billingId: billing.id,
                type: "Background Removal",
              },
            });
          });
        }

        console.log(`✅ 用户 ${userId} 成功扣除 ${requiredCredits} 积分`);
      } catch (error) {
        console.error("❌ 积分扣除失败:", error);
        // 如果积分扣除失败，不影响任务创建，但应该记录错误
        // 生产环境中可能需要回滚任务
      }
    }

    // 返回任务信息
    return NextResponse.json({ success: true, taskId: runninghubTaskId, taskRecordId: taskRecord?.id });

  } catch (error) {
    console.error("❌ 处理失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

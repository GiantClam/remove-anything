import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import dayjs from "dayjs";
import { z } from "zod";

import { Credits, model } from "@/config/constants";
import { FluxHashids } from "@/db/dto/flux.dto";
import { prisma } from "@/db/prisma";
import { getUserCredit } from "@/db/queries/account";
import { BillingType } from "@/db/type";
import { env } from "@/env.mjs";
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

const BatchRemoveBackgroundSchema = z.object({
  imageUrls: z.array(z.string().url()).min(1).max(10), // 最多10张图片
  isPrivate: z.number().default(0),
  locale: z.string().default("en"),
});

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
    const {
      imageUrls,
      isPrivate,
      locale,
    } = BatchRemoveBackgroundSchema.parse(data);

    const account = await getUserCredit(userId);
    const needCredit = Credits[model.backgroundRemoval] * imageUrls.length;
    
    if (account.credit < needCredit) {
      return NextResponse.json(
        { error: "Insufficient credit", code: 1000402 },
        { status: 400 },
      );
    }

    // 创建批量任务记录
    const batchTask = await prisma.batchTask.create({
      data: {
        userId,
        taskType: "background-removal",
        totalImages: imageUrls.length,
        completedImages: 0,
        failedImages: 0,
        status: "Processing",
        createdAt: new Date(),
        metadata: {
          isPrivate: Boolean(isPrivate),
          locale,
        },
      },
    });

    // 为每张图片创建单独的任务记录
    const imageTasks = await Promise.all(
      imageUrls.map(async (imageUrl, index) => {
        return prisma.fluxData.create({
          data: {
            userId,
            replicateId: "",
            inputPrompt: "Background removal",
            executePrompt: "Background removal",
            model: model.backgroundRemoval,
            aspectRatio: "1:1",
            taskStatus: "Processing",
            executeStartTime: BigInt(Date.now()),
            locale,
            isPrivate: Boolean(isPrivate),
            inputImageUrl: imageUrl,
            batchTaskId: batchTask.id,
            batchIndex: index,
          },
        });
      })
    );

    // 异步处理每张图片的背景去除
    const processPromises = imageUrls.map(async (imageUrl, index) => {
      const fluxData = imageTasks[index];
      
      try {
        console.log(`🚀 开始处理第 ${index + 1} 张图片的背景去除...`);
        
        // 调用 AI Gateway 进行背景去除
        const res = await aiGateway.generateImageViaReplicate({
          model: model.backgroundRemoval,
          input_image_url: imageUrl,
          input_prompt: "Background removal",
          is_private: Number(isPrivate) || 0,
          user_id: userId,
          locale,
        });

        if (res.error) {
          throw new Error(res.error);
        }

        // 更新任务状态为成功
        await prisma.fluxData.update({
          where: { id: fluxData.id },
          data: {
            replicateId: res.replicate_id || "",
            taskStatus: "Succeeded",
            executeEndTime: BigInt(Date.now()),
            imageUrl: res.output?.[0] || "",
            errorMsg: null,
          },
        });

        // 更新批量任务进度
        await prisma.batchTask.update({
          where: { id: batchTask.id },
          data: {
            completedImages: {
              increment: 1,
            },
          },
        });

        console.log(`✅ 第 ${index + 1} 张图片背景去除完成`);
        return { success: true, index, imageUrl: res.output?.[0] };

      } catch (error) {
        console.error(`❌ 第 ${index + 1} 张图片背景去除失败:`, error);
        
        // 更新任务状态为失败
        await prisma.fluxData.update({
          where: { id: fluxData.id },
          data: {
            taskStatus: "Failed",
            executeEndTime: BigInt(Date.now()),
            errorMsg: getErrorMessage(error),
          },
        });

        // 更新批量任务进度
        await prisma.batchTask.update({
          where: { id: batchTask.id },
          data: {
            failedImages: {
              increment: 1,
            },
          },
        });

        return { success: false, index, error: getErrorMessage(error) };
      }
    });

    // 等待所有图片处理完成
    const results = await Promise.allSettled(processPromises);
    
    // 检查是否所有图片都处理完成
    const completedCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = imageUrls.length - completedCount;
    
    // 更新批量任务最终状态
    await prisma.batchTask.update({
      where: { id: batchTask.id },
      data: {
        status: failedCount === 0 ? "Completed" : "PartialCompleted",
        completedImages: completedCount,
        failedImages: failedCount,
        completedAt: new Date(),
      },
    });

    // 扣除积分
    if (completedCount > 0) {
      const userCreditRecord = await prisma.userCredit.findFirst({
        where: { userId },
      });
      
      if (userCreditRecord) {
        await prisma.userCredit.update({
          where: { id: userCreditRecord.id },
          data: {
            credit: {
              decrement: Credits[model.backgroundRemoval] * completedCount,
            },
          },
        });
      }

      // 记录消费记录
      await prisma.userBilling.create({
        data: {
          userId,
          type: BillingType.Withdraw,
          amount: Credits[model.backgroundRemoval] * completedCount,
          description: `Batch background removal - ${completedCount} images`,
          state: "Success",
        },
      });
    }

    // 获取处理结果
    const processedTasks = await prisma.fluxData.findMany({
      where: { batchTaskId: batchTask.id },
      orderBy: { batchIndex: 'asc' },
    });

    return NextResponse.json({
      success: true,
      batchTaskId: batchTask.id,
      totalImages: imageUrls.length,
      completedImages: completedCount,
      failedImages: failedCount,
      results: processedTasks.map(task => ({
        id: task.id,
        index: task.batchIndex,
        status: task.taskStatus,
        originalImageUrl: task.inputImageUrl,
        processedImageUrl: task.imageUrl,
        error: task.errorMsg,
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
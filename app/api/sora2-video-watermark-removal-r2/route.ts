import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { runninghubAPI } from "@/lib/runninghub-api";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/db/prisma";
import { taskQueueManager } from "@/lib/task-queue";
import { Credits, model, TASK_QUEUE_CONFIG } from "@/config/constants";
import { BillingType } from "@/db/type";
import { getUserCredit } from "@/db/queries/account";
import { env } from "@/env.mjs";
import { uploadToR2, downloadFromR2 } from "@/lib/r2-upload";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: "Please use FormData for video upload" }, { status: 400 });
    }

    const formData = await req.formData();
    const video = formData.get('video') as File | null;
    const r2Url = formData.get('r2Url') as string | null;
    const orientation = formData.get('orientation') as string || 'landscape';
    const filename = formData.get('filename') as string | null;
    
    // 支持两种模式：直接文件上传或 R2 URL
    if (!video && !r2Url) {
      return NextResponse.json({ error: "Missing 'video' file or 'r2Url'" }, { status: 400 });
    }

    // 如果直接上传文件，检查文件大小
    if (video) {
      // 检查文件大小 (50MB 限制，考虑到 Vercel 的限制)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (video.size > maxSize) {
        return NextResponse.json({ 
          error: "视频文件大小不能超过 50MB。请压缩视频后重试。",
          code: "FILE_TOO_LARGE",
          maxSize: "50MB"
        }, { status: 413 });
      }

      // 检查最小文件大小 (1MB)
      const minSize = 1024 * 1024; // 1MB
      if (video.size < minSize) {
        return NextResponse.json({ 
          error: "视频文件大小至少需要 1MB",
          code: "FILE_TOO_SMALL",
          minSize: "1MB"
        }, { status: 400 });
      }
    }

    // 获取当前用户
    const user = await getCurrentUser();
    let userId = user?.id;
    
    // 开发模式：如果getCurrentUser返回null，使用测试用户ID
    if (!userId && process.env.NODE_ENV === "development") {
      userId = "dev-user-123";
    }

    // 检查用户积分（仅对登录用户）
    if (userId) {
      const requiredCredits = Credits[model.sora2VideoWatermarkRemoval];
      
      // 开发模式：直接跳过积分检查
      if (process.env.NODE_ENV === "development") {
        // 开发模式下跳过积分检查
      } else {
        const userCredit = await getUserCredit(userId);

        if (!userCredit || userCredit.credit < requiredCredits) {
          return NextResponse.json({
            error: "积分不足",
            code: "INSUFFICIENT_CREDITS",
            required: requiredCredits,
            current: userCredit?.credit || 0
          }, { status: 400 });
        }
      }
    }

    console.log("🎬 开始处理 Sora2 视频去水印任务");
    
    let finalR2Url: string;
    let finalFilename: string;
    let finalContentType: string;

    if (video) {
      // 模式1: 直接文件上传
      console.log("📁 文件信息:", {
        name: video.name,
        size: video.size,
        type: video.type,
        orientation: orientation
      });

      // 步骤1: 上传文件到 R2
      console.log("📤 步骤1: 上传文件到 Cloudflare R2...");
      finalR2Url = await uploadToR2(video);
      finalFilename = video.name;
      finalContentType = video.type || 'video/mp4';
      console.log("✅ R2 上传成功:", finalR2Url);
    } else {
      // 模式2: 使用已有的 R2 URL
      console.log("📁 使用已有 R2 URL:", r2Url);
      finalR2Url = r2Url!;
      finalFilename = filename || 'video.mp4';
      finalContentType = 'video/mp4';
    }

    // 步骤2: 从 R2 下载文件并上传到 RunningHub
    console.log("📥 步骤2: 从 R2 下载文件并上传到 RunningHub...");
    
    let fileName: string;
    
    if (video) {
      // 模式1: 直接上传文件到 RunningHub
      console.log("📤 直接上传文件到 RunningHub...");
      const videoBuffer = Buffer.from(await video.arrayBuffer());
      fileName = await runninghubAPI.uploadFile(videoBuffer, {
        fileType: 'video',
        filename: finalFilename,
        contentType: finalContentType
      });
    } else {
      // 模式2: 从 R2 下载文件并上传到 RunningHub
      console.log("📥 从 R2 下载文件并上传到 RunningHub...");
      const videoBuffer = await downloadFromR2(finalR2Url);
      fileName = await runninghubAPI.uploadFile(videoBuffer, {
        fileType: 'video',
        filename: finalFilename,
        contentType: finalContentType
      });
    }
    
    console.log("✅ RunningHub 上传成功，文件名:", fileName);

    // 步骤3: 创建任务记录
    console.log("📝 步骤3: 创建任务记录...");
    const taskRecord = await prisma.fluxData.create({
      data: {
        userId: userId,
        model: "sora2-video-watermark-removal",
        inputPrompt: `Sora2 video watermark removal - ${finalFilename}`,
        taskStatus: "processing",
        imageUrl: null, // 将在任务完成后更新
        isPrivate: true,
        executeStartTime: BigInt(Date.now()),
        executeEndTime: null,
        replicateId: "", // 将在创建 RunningHub 任务后更新
      } as any,
    });

    console.log("✅ 任务记录创建成功，ID:", taskRecord.id);

    // 步骤4: 创建 RunningHub 任务
    console.log("🚀 步骤4: 创建 RunningHub 任务...");
    const workflowId = orientation === 'portrait' 
      ? env.SORA2_PORTRAIT_WORKFLOW_ID 
      : env.SORA2_LANDSCAPE_WORKFLOW_ID;

    const nodeInfoList = [
      {
        nodeId: "205", // 正确的节点ID
        fieldName: "video", // 正确的字段名
        fieldValue: fileName // 使用 RunningHub 文件名
      }
    ];

    const taskId = await runninghubAPI.createTaskGeneric({
      workflowId,
      nodeInfoList,
      taskRecordId: taskRecord.id
    });

    console.log("✅ RunningHub 任务创建成功，任务ID:", taskId);

    // 步骤5: 更新任务记录
    await prisma.fluxData.update({
      where: { id: taskRecord.id },
      data: {
        replicateId: taskId
      }
    });

    // 步骤6: 扣除积分（仅对登录用户）
    if (userId && process.env.NODE_ENV !== "development") {
      console.log("💰 步骤6: 扣除用户积分...");
      const requiredCredits = Credits[model.sora2VideoWatermarkRemoval];
      await deductCredits(userId, requiredCredits, taskRecord.id);
    }

    // 步骤7: 添加到任务队列
    console.log("📋 步骤7: 添加到任务队列...");
    await taskQueueManager.addTask({
      taskType: "sora2-video-watermark-removal",
      priority: 1,
      userId: userId || "anonymous",
      metadata: {
        taskRecordId: taskRecord.id,
        userId: userId,
        orientation: orientation,
        r2Url: finalR2Url,
        runninghubFileName: fileName
      }
    });

    console.log("🎉 Sora2 视频去水印任务创建完成！");

    return NextResponse.json({
      success: true,
      taskId: taskId,
      recordId: taskRecord.id,
      message: "Sora2 video watermark removal task created successfully",
      r2Url: finalR2Url,
      runninghubFileName: fileName
    });

  } catch (error) {
    console.error("❌ Sora2 视频去水印任务创建失败:", error);
    
    // 检查是否是视频文件验证失败
    if (error instanceof Error && error.message.includes("Invalid video file")) {
      return NextResponse.json(
        { 
          error: "视频文件格式不支持或文件损坏。请确保上传的是有效的 MP4 视频文件，并且文件大小不超过 50MB。",
          code: "INVALID_VIDEO_FILE"
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: getErrorMessage(error),
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * 扣除用户积分
 */
async function deductCredits(userId: string, credits: number, taskId: number) {
  try {
    console.log(`💰 扣除用户 ${userId} ${credits} 积分，任务ID: ${taskId}`);
    
    // 开始事务
    const result = await prisma.$transaction(async (tx) => {
      // 获取当前积分
      const userCredit = await tx.userCredit.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (!userCredit || userCredit.credit < credits) {
        throw new Error("积分不足");
      }

      // 扣除积分
      const newCredit = userCredit.credit - credits;
      await tx.userCredit.update({
        where: { id: userCredit.id },
        data: { credit: newCredit }
      });

      // 创建计费记录
      const billing = await tx.userBilling.create({
        data: {
          userId: userId,
          state: "Done",
          amount: -credits, // 负数表示扣除
          type: "Consume",
          description: `Sora2 Video Watermark Removal - Task ID: ${taskId}`,
        },
      });

      // 创建积分交易记录
      await tx.userCreditTransaction.create({
        data: {
          userId: userId,
          credit: -credits, // 负数表示扣除
          balance: newCredit,
          billingId: billing.id,
          type: "Sora2 Video Watermark Removal",
        },
      });

      console.log(`✅ 积分扣除成功，用户 ${userId} 剩余积分: ${newCredit}`);
      return { newCredit, billing };
    });

    return result;
  } catch (error) {
    console.error("❌ 积分扣除失败:", error);
    throw error;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { runninghubAPI } from "@/lib/runninghub-api";
import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { prisma } from "@/db/prisma";
import { taskQueueManager } from "@/lib/task-queue";
import { Credits, model, TASK_QUEUE_CONFIG } from "@/config/constants";
import { BillingType } from "@/db/type";
import { getUserCredit } from "@/db/queries/account";
import { env } from "@/env.mjs";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: "Please use FormData for video upload" }, { status: 400 });
    }

    const formData = await req.formData();
    const video = formData.get('video') as File | null;
    if (!video) {
      return NextResponse.json({ error: "Missing 'video' file" }, { status: 400 });
    }

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

    // 获取当前用户
    const auth = createProjectAuthProvider();
    const user = await auth.getCurrentUser();
    let userId = user?.userId;
    
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

    // 上传视频文件到 RunningHub
    const arrayBuffer = await video.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadedFileName = await runninghubAPI.uploadFile(buffer, {
      fileType: 'video',
      filename: video.name || 'video.mp4',
      contentType: video.type || 'video/mp4',
    });

    // 获取屏幕方向配置（横屏或竖屏）
    const orientation = formData.get('orientation') as string | undefined;
    if (!orientation || !['landscape', 'portrait'].includes(orientation)) {
      return NextResponse.json({ error: "Missing or invalid orientation parameter" }, { status: 400 });
    }

    // 根据屏幕方向选择对应的 workflow ID（从环境变量读取）
    const workflowId = orientation === 'landscape' 
      ? env.SORA2_LANDSCAPE_WORKFLOW_ID 
      : env.SORA2_PORTRAIT_WORKFLOW_ID;
    
    const uploadNodeId = '205';
    const uploadFieldName = 'video';

    // 创建任务记录
    let taskRecord;
    try {
      taskRecord = await prisma.fluxData.create({
        data: {
          userId: userId || "anonymous",
          replicateId: "pending", // 先标记为pending，稍后更新
          inputPrompt: "Sora2 Video Watermark Removal",
          executePrompt: "Sora2 Video Watermark Removal",
          model: "sora2-video-watermark-removal",
          aspectRatio: "16:9",
          taskStatus: "Processing", // 先标记为处理中
          inputImageUrl: uploadedFileName,
          isPrivate: false,
        },
      });
      console.log("✅ Sora2 视频去水印任务记录创建成功:", taskRecord.id);
    } catch (dbError) {
      console.error("❌ 创建任务记录失败:", dbError);
      return NextResponse.json({ error: "Failed to create task record" }, { status: 500 });
    }

    // 直接尝试创建 RunningHub 任务
    try {
      const runninghubTaskId = await runninghubAPI.createVideoWatermarkRemovalTask(uploadedFileName, undefined, {
        workflowId,
        uploadNodeId,
        uploadFieldName,
      });

      // 更新任务记录
      await prisma.fluxData.update({
        where: { id: taskRecord.id },
        data: {
          replicateId: runninghubTaskId,
          taskStatus: "Processing",
        },
      });

      // 扣除积分
      if (userId) {
        const requiredCredits = Credits[model.sora2VideoWatermarkRemoval];
        await deductCredits(userId, requiredCredits, taskRecord.id);
      }

      return NextResponse.json({ 
        success: true, 
        taskId: runninghubTaskId, 
        taskRecordId: taskRecord.id,
        status: "processing",
        message: "任务已开始处理"
      });

           } catch (error) {
             console.error("❌ 创建RunningHub任务失败:", error);
             
             // 检查是否是可重试的错误（队列满或机器不足）
             const errorMessage = error instanceof Error ? error.message : '';
             const isRetryableError = errorMessage.includes('TASK_QUEUE_MAXED') || 
                                     errorMessage.includes('TASK_INSTANCE_MAXED') ||
                                     errorMessage.includes('421') ||
                                     errorMessage.includes('415');

             // 检查是否是视频文件验证错误
             const isVideoValidationError = errorMessage.includes('Invalid video file') ||
                                          errorMessage.includes('custom_validation_failed') ||
                                          errorMessage.includes('VHS_LoadVideo');

             if (isVideoValidationError) {
               // 视频文件验证失败，标记任务失败并返回具体错误
               await prisma.fluxData.update({
                 where: { id: taskRecord.id },
                 data: {
                   taskStatus: "Failed",
                   errorMsg: "Invalid video file format. Please ensure your video is a valid MP4, MOV, AVI, MKV, or WEBM file with proper encoding."
                 },
               });
               
               return NextResponse.json({ 
                 error: "Invalid video file format", 
                 details: "RunningHub cannot process this video file. Please try:\n1. Re-encoding the video with H.264 codec\n2. Using a different video file\n3. Converting to MP4 format\n4. Ensuring the video is not corrupted",
                 code: "INVALID_VIDEO_FILE",
                 suggestions: [
                   "Re-encode with H.264 codec",
                   "Try a different video file", 
                   "Convert to MP4 format",
                   "Check if video is corrupted"
                 ]
               }, { status: 400 });
             }

             if (isRetryableError) {
        // 加入等待队列
        const { taskId: queueTaskId, queuePosition } = await taskQueueManager.addTask({
          userId: userId || "anonymous",
          taskType: "sora2-video-watermark-removal",
          priority: 1,
          metadata: {
            taskRecordId: taskRecord.id,
            uploadedFileName,
            workflowId,
            uploadNodeId,
            uploadFieldName,
          }
        });

        // 更新任务状态为等待
        await prisma.fluxData.update({
          where: { id: taskRecord.id },
          data: {
            taskStatus: "Queued",
          },
        });

        return NextResponse.json({ 
          success: true, 
          taskId: queueTaskId, 
          taskRecordId: taskRecord.id,
          status: "queued",
          queuePosition,
          message: "系统繁忙，任务已加入等待队列，将在资源可用时自动重试"
        });
      } else {
        // 不可重试的错误，标记任务失败
        await prisma.fluxData.update({
          where: { id: taskRecord.id },
          data: {
            taskStatus: "Failed",
          },
        });
        
        return NextResponse.json({ 
          error: "创建任务失败", 
          details: errorMessage 
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error("❌ 视频去水印任务创建失败:", error);
    
    // 检查是否是视频文件验证失败
    if (error instanceof Error && error.message.includes("Invalid video file")) {
      return NextResponse.json(
        { 
          error: "视频文件格式不支持或文件损坏。请确保上传的是有效的 MP4 视频文件，并且文件大小不超过 100MB。",
          code: "INVALID_VIDEO_FILE"
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

// 扣除积分的辅助函数
async function deductCredits(userId: string, requiredCredits: number, taskRecordId: number) {
  // 开发模式：跳过积分扣除
  if (process.env.NODE_ENV === "development") {
    return;
  }

  try {
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
          description: `Sora2 Video Watermark Removal - Task ${taskRecordId}`,
        },
      });

      // 创建积分交易记录
      await tx.userCreditTransaction.create({
        data: {
          userId,
          credit: -requiredCredits,
          balance: newCreditBalance,
          billingId: billing.id,
          type: "Sora2 Video Watermark Removal",
        },
      });
    });

    console.log(`✅ 用户 ${userId} 成功扣除 ${requiredCredits} 积分`);
  } catch (error) {
    console.error("❌ 积分扣除失败:", error);
    throw error;
  }
}



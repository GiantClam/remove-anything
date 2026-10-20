import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { runninghubAPI } from "@/modules/runninghub";
import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { prisma } from "@/db/prisma";
import { Credits, model } from "@/config/constants";
import { BillingType } from "@/db/type";
import { getUserCredit } from "@/db/queries/account";
import { env } from "@/env.mjs";
import {
  TaskCreationOutcomeUnknownError,
  TaskCreationRejectedError,
} from "@/modules/runninghub/sdk";

// 包装函数以匹配适配器期望的类型
const getCurrentUser = async () => {
  const user = await getCurrentUserOriginal();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  };
};

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
    const auth = createProjectAuthProvider(getCurrentUser);
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
    
    if (!workflowId || workflowId === 'placeholder') {
      return NextResponse.json(
        { error: 'Sora2 workflow ID not configured. Please set SORA2_LANDSCAPE_WORKFLOW_ID and SORA2_PORTRAIT_WORKFLOW_ID environment variables.' },
        { status: 500 }
      );
    }
    
    const uploadNodeId = env.SORA2_UPLOAD_NODE_ID || '205';
    const uploadFieldName = env.SORA2_UPLOAD_FIELD_NAME || 'video';

    // 5. 创建任务记录
    const taskRecord = await prisma.taskData.create({
      data: {
        userId: userId || null,
        model: "sora2-video-watermark-removal",
        inputPrompt: `Sora2 video watermark removal - ${uploadedFileName}`,
        inputImageUrl: uploadedFileName, // RunningHub filename
        taskStatus: "pending",
        isPrivate: true,
        orientation: orientation as "landscape" | "portrait" | null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Provider creation is the no-replay boundary. The SDK may retry once only
    // after its explicit capacity rejection; route-level fallback must never
    // submit the same paid task again.
    let runninghubTaskId: string | undefined;
    let providerCreateStarted = false;
    try {
      await prisma.taskData.update({
        where: { id: taskRecord.id },
        data: { taskStatus: "Processing" },
      });
      providerCreateStarted = true;
      runninghubTaskId = await runninghubAPI.createVideoWatermarkRemovalTask(uploadedFileName, taskRecord.id, {
        workflowId,
        uploadNodeId,
        uploadFieldName,
      });

      // 更新任务记录
      await prisma.taskData.update({
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isExplicitRejection =
        error instanceof TaskCreationRejectedError ||
        ((error as { code?: string; taskWasNotCreated?: boolean })?.code === "TASK_CREATION_REJECTED" &&
          (error as { taskWasNotCreated?: boolean })?.taskWasNotCreated === true);
      const isUnknownOutcome =
        error instanceof TaskCreationOutcomeUnknownError ||
        (providerCreateStarted && !isExplicitRejection);

      // A returned provider ID proves creation even if a later database or
      // billing write failed. Keep it visible and never turn it into a retry.
      if (runninghubTaskId) {
        try {
          await prisma.taskData.update({
            where: { id: taskRecord.id },
            data: { replicateId: runninghubTaskId, taskStatus: "Processing" },
          });
        } catch (persistenceError) {
          console.error("❌ Provider task could not be linked for reconciliation:", persistenceError);
        }
        return NextResponse.json({
          success: true,
          taskId: runninghubTaskId,
          taskRecordId: taskRecord.id,
          status: "processing",
          message: "Provider task was created; follow-up persistence needs reconciliation.",
        }, { status: 202 });
      }

      // Transport and malformed-response outcomes may hide a provider task.
      // Keep the record active for reconciliation rather than inviting a retry.
      if (isUnknownOutcome) {
        try {
          await prisma.taskData.update({
            where: { id: taskRecord.id },
            data: {
              taskStatus: "Processing",
              errorMsg: errorMessage,
            },
          });
        } catch (persistenceError) {
          console.error("❌ Unknown provider outcome could not be persisted:", persistenceError);
        }
        return NextResponse.json({
          success: false,
          taskRecordId: taskRecord.id,
          status: "submission-unknown",
          code: "TASK_CREATION_OUTCOME_UNKNOWN",
          message: "Provider submission outcome is unknown. Check task status before retrying.",
        }, { status: 202 });
      }

      const isVideoValidationError = errorMessage.includes("Invalid video file") ||
        errorMessage.includes("custom_validation_failed") ||
        errorMessage.includes("VHS_LoadVideo");
      await prisma.taskData.update({
        where: { id: taskRecord.id },
        data: {
          taskStatus: "Failed",
          errorMsg: isVideoValidationError
            ? "Invalid video file format. Please ensure your video is a valid MP4, MOV, AVI, MKV, or WEBM file with proper encoding."
            : errorMessage,
        },
      });

      if (isVideoValidationError) {
        return NextResponse.json({
          error: "Invalid video file format",
          details: "RunningHub cannot process this video file. Please try:\n1. Re-encoding the video with H.264 codec\n2. Using a different video file\n3. Converting to MP4 format\n4. Ensuring the video is not corrupted",
          code: "INVALID_VIDEO_FILE",
          suggestions: [
            "Re-encode with H.264 codec",
            "Try a different video file",
            "Convert to MP4 format",
            "Check if video is corrupted",
          ],
        }, { status: 400 });
      }

      return NextResponse.json({
        error: "创建任务失败",
        code: isExplicitRejection ? "TASK_CREATION_REJECTED" : undefined,
        details: errorMessage,
      }, { status: 502 });
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



import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { createRunningHubClient } from "@/modules/runninghub";
import { createPrismaTaskRepository } from "@/modules/tasks/adapters/prisma-repo";
import { createVideoTaskWithR2Url } from "@/modules/tasks/sdk";
import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { prisma } from "@/db/prisma";
import { taskQueueManager } from "@/lib/task-queue";
import { Credits, model, TASK_QUEUE_CONFIG } from "@/config/constants";
import { BillingType } from "@/db/type";
import { getUserCredit } from "@/db/queries/account";
import { env } from "@/env.mjs";
import { uploadToR2 } from "@/lib/r2-upload";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { createR2S3Service } from "@/lib/r2-s3";
import {
  anonymousPrincipalCookie,
  createAnonymousPrincipal,
  getAnonymousPrincipalFromRequest,
  getTaskPrincipalFromRequest,
} from "@/lib/task-lifecycle";
import { getSora2SubmissionDisposition } from "@/lib/video-task-queue-contract";

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
  let taskRecord: any = null;
  let json = (payload: unknown, init?: ResponseInit) =>
    NextResponse.json(payload, init);
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
    const auth = createProjectAuthProvider(getCurrentUser);
    const user = await auth.getCurrentUser();
    let userId = user?.userId;
    
    // 开发模式：如果getCurrentUser返回null，使用测试用户ID
    if (!userId && process.env.NODE_ENV === "development") {
      userId = "dev-user-123";
    }

    // Bind anonymous video tasks to the same signed principal used by the
    // image tools. This lets the original browser download its private result
    // while keeping the task inaccessible to another anonymous principal.
    const incomingPrincipalToken = req.cookies.get(
      "remove_anything_principal",
    )?.value;
    const existingPrincipalId = getAnonymousPrincipalFromRequest(req);
    const principalToken = userId
      ? null
      : existingPrincipalId
        ? incomingPrincipalToken
        : createAnonymousPrincipal();
    const principalRequest =
      !userId && principalToken && !existingPrincipalId
        ? new Request(req.url, {
            headers: { cookie: `remove_anything_principal=${principalToken}` },
          })
        : req;
    const { principalId } = getTaskPrincipalFromRequest(
      principalRequest,
      userId,
    );
    json = (payload: unknown, init?: ResponseInit) => {
      const response = NextResponse.json(payload, init);
      if (!userId && principalToken && !existingPrincipalId) {
        response.headers.append(
          "Set-Cookie",
          anonymousPrincipalCookie(principalToken),
        );
      }
      return response;
    };

    // 检查用户积分（仅对登录用户）
    if (userId) {
      const requiredCredits = Credits[model.sora2VideoWatermarkRemoval];
      
      // 开发模式：直接跳过积分检查
      if (process.env.NODE_ENV === "development") {
        // 开发模式下跳过积分检查
      } else {
        const userCredit = await getUserCredit(userId);

        if (!userCredit || userCredit.credit < requiredCredits) {
          return json({
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
    let routeUploadedInput = false;

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
      routeUploadedInput = true;
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

    // RunningHub cannot fetch a private raw R2 endpoint. Keep the stable
    // object URL in the task record, but submit a short-lived signed URL for
    // files uploaded by this request. The old Media Transform path treated
    // the raw R2 API host as a Cloudflare zone and returned HTTP 400.
    const objectKey = getR2ObjectKey(finalR2Url, env.R2_URL_BASE);
    const providerInputUrl =
      routeUploadedInput && objectKey
        ? await createR2S3Service().getSignedUrl(
            objectKey,
            env.R2_BUCKET,
            60 * 60,
          )
        : finalR2Url;
    const transformUrl = providerInputUrl;
    console.log("⏳ 已准备 RunningHub 输入 URL，准备创建任务记录并同步触发任务...");

    // 步骤3: 创建任务记录
    console.log("📝 步骤3: 创建任务记录...");
    taskRecord = await prisma.taskData.create({
      data: {
        userId: userId || null,
        principalId,
        model: "sora2-video-watermark-removal",
        inputPrompt: "",
        inputImageUrl: finalR2Url,
        taskStatus: "pending",
        isPrivate: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    console.log("✅ 任务记录创建成功，ID:", taskRecord.id);

    // 步骤4: 通过可复用编排 SDK 同步创建；失败则入队
    const workflowId = (orientation === 'portrait')
      ? process.env.SORA2_PORTRAIT_WORKFLOW_ID
      : process.env.SORA2_LANDSCAPE_WORKFLOW_ID;
    
    if (!workflowId || workflowId === 'placeholder') {
      return json(
        { error: 'Sora2 workflow ID not configured. Please set SORA2_LANDSCAPE_WORKFLOW_ID and SORA2_PORTRAIT_WORKFLOW_ID environment variables.' },
        { status: 500 }
      );
    }
    const rh = createRunningHubClient();
    const repo = createPrismaTaskRepository();
    const isPortrait = orientation === "portrait";
    const uploadNodeId = env.SORA2_UPLOAD_NODE_ID || (isPortrait ? '153' : '205');
    const result = await createVideoTaskWithR2Url({
      model: 'sora2-video-watermark-removal',
      userId: userId || undefined,
      workflowId,
      uploadNodeId,
      uploadFieldName: 'video',
      r2Url: providerInputUrl,
      taskRecordId: taskRecord.id,
    }, { repo, rh });

    const disposition = getSora2SubmissionDisposition(result);
    if (disposition.accepted && disposition.status === "processing" && disposition.taskId) {
      // The SDK reports this case only when RunningHub returned a task ID but
      // its repository write failed. Retry the local link only; never create
      // the provider task again.
      if (!result.ok && result.submissionOutcome === "created") {
        try {
          await prisma.taskData.update({
            where: { id: taskRecord.id },
            data: { replicateId: disposition.taskId, taskStatus: "Processing" },
          });
        } catch (persistenceError) {
          console.error("Provider task created but task record needs reconciliation:", persistenceError);
          return json({
            success: true,
            taskId: disposition.taskId,
            recordId: taskRecord.id,
            status: "processing",
            message: "Provider task was created; task record needs reconciliation.",
          }, { status: 202 });
        }
      }

      // 启动后端状态监控
      try {
        const { taskQueueManager } = await import('@/lib/task-queue');
        taskQueueManager.startStatusWatcher(taskRecord.id, disposition.taskId);
      } catch {}

      return json({ success: true, taskId: disposition.taskId, recordId: taskRecord.id, message: 'Task started', transformUrl }, { status: 200 });
    }
    if (disposition.accepted && disposition.status === "submission-unknown") {
      return json({
        success: false,
        recordId: taskRecord.id,
        status: disposition.status,
        code: disposition.code,
        message: "Provider submission outcome is unknown. Check task status before retrying.",
        transformUrl,
      }, { status: 202 });
    }
    console.error("RunningHub 同步创建失败; no queue replay is allowed after provider submission:", { error: disposition.error, workflowId, uploadNodeId, transformUrl });
    return json({
      error: "Failed to create task",
      code: disposition.code,
      recordId: taskRecord.id,
      status: disposition.status,
      details: disposition.error,
      transformUrl,
    }, { status: 502 });

  } catch (error) {
    console.error("❌ Sora2 视频去水印任务创建失败:", error);
    
    // 检查是否是视频文件验证失败
    if (error instanceof Error && error.message.includes("Invalid video file")) {
      return json(
        { 
          error: "视频文件格式不支持或文件损坏。请确保上传的是有效的 MP4 视频文件，并且文件大小不超过 50MB。",
          code: "INVALID_VIDEO_FILE"
        },
        { status: 400 }
      );
    }

    // 如果已创建任务记录，则更新状态为失败
    try {
      if (taskRecord?.id) {
        await prisma.taskData.update({
          where: { id: taskRecord.id },
          data: {
            taskStatus: "failed",
            errorMsg: error instanceof Error ? error.message : "Failed to start task",
          },
        });
      }
    } catch (updateError) {
      console.error("❌ 更新任务状态失败:", updateError);
    }

    return json(
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

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { buildMediaTransformUrl, prewarmTransformUrl } from "@/lib/cf-media";
import { db as prisma } from "@/lib/db";
import { taskQueueManager } from "@/lib/task-queue";
import {
  enqueueSora2VideoQueueItem,
  getSora2SubmissionDisposition,
} from "@/lib/video-task-queue-contract";
import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { createRunningHubClient } from "@/modules/runninghub";
import { createPrismaTaskRepository } from "@/modules/tasks/adapters/prisma-repo";
import { createVideoTaskWithR2Url } from "@/modules/tasks/sdk";

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

export async function POST(req: NextRequest) {
  try {
    // 1. 用户认证
    const auth = createProjectAuthProvider(getCurrentUser);
    const user = await auth.getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.userId;

    // 2. 解析请求参数
    const formData = await req.formData();
    const url = formData.get("url") as string;
    const orientation = (formData.get("orientation") as string) || "portrait";

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // 3. Validate the URL before either queueing it or passing it to provider.
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (
        (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        throw new Error("Invalid URL protocol or credentials");
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    // 4. 检查用户积分
    const needCredit = 7; // Sora2视频去水印需要7积分
    const userCredit = await prisma.userCredit.findFirst({
      where: { userId },
    });

    if (!userCredit || userCredit.credit < needCredit) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS",
          required: needCredit,
          current: userCredit?.credit || 0,
        },
        { status: 400 },
      );
    }

    // 5. 创建任务记录
    const taskRecord = await prisma.taskData.create({
      data: {
        userId,
        model: "sora2-video-watermark-removal",
        inputPrompt: `Remove watermark from video: ${url}`,
        inputImageUrl: url,
        taskStatus: "pending",
        isPrivate: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 6. 创建适配器实例
    const repo = createPrismaTaskRepository();
    const rh = createRunningHubClient();

    let providerTaskId: string | undefined;
    try {
      // 7. Construct and prewarm a transform only for the exact configured R2
      // hostname. External URLs stay provider inputs; the app server does not
      // fetch them.
      const r2Base = new URL(
        process.env.R2_URL_BASE || "https://s.remove-anything.com",
      );
      const zoneHost = r2Base.host;
      const isR2Url =
        parsedUrl.protocol === r2Base.protocol &&
        parsedUrl.host.toLowerCase() === r2Base.host.toLowerCase();
      let r2InputUrl = url;
      let transformUrl: string | undefined;
      if (isR2Url) {
        try {
          const filename = "video.mp4";
          const isPortrait = orientation === "portrait";
          transformUrl = buildMediaTransformUrl(zoneHost, url, {
            width: isPortrait ? 704 : 1280,
            height: isPortrait ? 1280 : 704,
            fit: "scale-down",
            audio: true,
            filename,
          });
          await prewarmTransformUrl(transformUrl);
          r2InputUrl = transformUrl;
        } catch (e) {
          console.error("构造/预热 transformUrl 失败，改为入队后台处理:", e);
          await enqueueSora2VideoQueueItem(prisma.processingQueue, {
            payload: {
              taskRecordId: taskRecord.id,
              userId,
              orientation,
              r2Url: url,
              ...(transformUrl ? { transformUrl } : {}),
            },
            lastError: String(e),
          });
          return NextResponse.json(
            {
              success: true,
              recordId: taskRecord.id,
              status: "queued",
              message: "R2 transform prewarm failed. Task queued.",
            },
            { status: 202 },
          );
        }
      } else {
        // Non-R2 URL: persist a queue row before reporting queued. The cron
        // processor passes this validated URL directly to the provider and
        // never fetches it through the application server.
        await enqueueSora2VideoQueueItem(prisma.processingQueue, {
          payload: {
            taskRecordId: taskRecord.id,
            userId,
            orientation,
            r2Url: url,
          },
          lastError: "non-R2-url",
        });
        return NextResponse.json(
          {
            success: true,
            recordId: taskRecord.id,
            status: "queued",
            message: "Non-R2 URL. Task queued for background processing.",
          },
          { status: 202 },
        );
      }

      // 8. 按横竖屏切换工作流与上传节点，同步创建 RunningHub 任务
      const workflowId =
        orientation === "portrait"
          ? process.env.SORA2_PORTRAIT_WORKFLOW_ID
          : process.env.SORA2_LANDSCAPE_WORKFLOW_ID;

      if (!workflowId || workflowId === "placeholder") {
        return NextResponse.json(
          {
            error:
              "Sora2 workflow ID not configured. Please set SORA2_LANDSCAPE_WORKFLOW_ID and SORA2_PORTRAIT_WORKFLOW_ID environment variables.",
          },
          { status: 500 },
        );
      }
      const uploadNodeId = orientation === "portrait" ? "153" : "205";
      const result = await createVideoTaskWithR2Url(
        {
          model: "sora2-video-watermark-removal",
          userId: userId,
          workflowId,
          uploadNodeId,
          uploadFieldName: "video",
          r2Url: r2InputUrl,
          taskRecordId: taskRecord.id,
        },
        { repo, rh },
      );

      const disposition = getSora2SubmissionDisposition(result);
      if (!disposition.accepted) {
        return NextResponse.json(
          {
            error: "Failed to create task",
            code: disposition.code,
            details: disposition.error,
            recordId: disposition.recordId,
            status: disposition.status,
          },
          { status: 502 },
        );
      }

      if (disposition.status === "submission-unknown") {
        return NextResponse.json(
          {
            success: false,
            recordId: disposition.recordId,
            status: disposition.status,
            code: disposition.code,
            message:
              "Provider submission outcome is unknown. Check task status before retrying.",
          },
          { status: 202 },
        );
      }

      providerTaskId = disposition.taskId;
      if (!providerTaskId) {
        return NextResponse.json(
          {
            error: "Provider task created without an identifier",
            recordId: disposition.recordId,
          },
          { status: 502 },
        );
      }

      // The provider task is known to exist when the SDK returns this
      // disposition. If its repository link write failed, retry only the
      // local record update; never call the provider again.
      if (!result.ok && result.submissionOutcome === "created") {
        try {
          await prisma.taskData.update({
            where: { id: taskRecord.id },
            data: { replicateId: providerTaskId, taskStatus: "Processing" },
          });
        } catch (persistenceError) {
          console.error(
            "Provider task created but task record needs reconciliation:",
            {
              recordId: taskRecord.id,
              taskId: providerTaskId,
              error: persistenceError,
            },
          );
          return NextResponse.json(
            {
              success: true,
              taskId: providerTaskId,
              recordId: taskRecord.id,
              status: "processing",
              message:
                "Provider task was created; task record needs reconciliation.",
            },
            { status: 202 },
          );
        }
      }

      // At this point the provider ID is linked. Watcher startup is best
      // effort and must not change the accepted task state.
      try {
        taskQueueManager.startStatusWatcher(taskRecord.id, providerTaskId);
      } catch (watcherError) {
        console.error("Could not start task status watcher:", watcherError);
      }

      // 10. 扣除积分
      await prisma.userCredit.update({
        where: { id: userCredit.id },
        data: { credit: { decrement: needCredit } },
      });

      return NextResponse.json({
        success: true,
        taskId: providerTaskId,
        recordId: taskRecord.id,
        status: "processing",
      });
    } catch (error: any) {
      console.error("同步创建任务失败:", error);

      // createVideoTaskWithR2Url owns provider submission and persistence. If
      // a later route action fails, keep the created task live and return its
      // ID so the client does not resubmit a paid job.
      if (providerTaskId) {
        return NextResponse.json(
          {
            success: true,
            taskId: providerTaskId,
            recordId: taskRecord.id,
            status: "processing",
            message:
              "Task was created; follow-up processing needs reconciliation.",
            details: error instanceof Error ? error.message : String(error),
          },
          { status: 202 },
        );
      }

      // 其他错误直接返回失败
      await prisma.taskData.update({
        where: { id: taskRecord.id },
        data: {
          taskStatus: "failed",
          errorMsg:
            error instanceof Error ? error.message : "Failed to start task",
        },
      });

      return NextResponse.json(
        {
          error: "Failed to create task",
          details: String(error),
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Sora2 video watermark removal URL error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: String(error),
      },
      { status: 500 },
    );
  }
}

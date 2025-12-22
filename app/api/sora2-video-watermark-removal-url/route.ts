import { NextRequest, NextResponse } from "next/server";
import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { createVideoTaskWithR2Url } from "@/modules/tasks/sdk";
import { createPrismaTaskRepository } from "@/modules/tasks/adapters/prisma-repo";
import { createPrismaTaskQueue } from "@/modules/tasks/adapters/prisma-queue";
import { createRunningHubClient } from "@/modules/runninghub";
import { taskQueueManager } from "@/lib/task-queue";
import { db as prisma } from "@/lib/db";
import { buildMediaTransformUrl, prewarmTransformUrl } from "@/lib/cf-media";

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
    const orientation = formData.get("orientation") as string || "portrait";

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // 3. 验证URL格式
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // 4. 检查用户积分
    const needCredit = 7; // Sora2视频去水印需要7积分
    const userCredit = await prisma.userCredit.findFirst({
      where: { userId },
    });

    if (!userCredit || userCredit.credit < needCredit) {
      return NextResponse.json({ 
        error: "Insufficient credits", 
        code: "INSUFFICIENT_CREDITS",
        required: needCredit,
        current: userCredit?.credit || 0
      }, { status: 400 });
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
      },
    });

    // 6. 创建适配器实例
    const repo = createPrismaTaskRepository();
    const queue = createPrismaTaskQueue();
    const rh = createRunningHubClient();

    try {
      // 7. 构造 transformUrl（仅当 URL 属于 R2 域名）；否则直接入队
      const zoneHost = (process.env.R2_URL_BASE || 'https://s.remove-anything.com').replace('https://', '').replace(/\/$/, '');
      const isR2Url = typeof url === 'string' && url.includes(zoneHost);
      let r2InputUrl = url;
      if (isR2Url) {
        try {
          const filename = 'video.mp4';
          const isPortrait = orientation === 'portrait';
          const transformUrl = buildMediaTransformUrl(zoneHost, url, {
            width: isPortrait ? 704 : 1280,
            height: isPortrait ? 1280 : 704,
            fit: 'scale-down',
            audio: true,
            filename
          });
          await prewarmTransformUrl(transformUrl);
          r2InputUrl = transformUrl;
        } catch (e) {
          console.error('构造/预热 transformUrl 失败，改为入队后台处理:', e);
          await prisma.processingQueue.create({
            data: {
              taskType: "sora2-video-watermark-removal",
              payload: { taskRecordId: taskRecord.id, userId, orientation, r2Url: url },
              status: "pending",
              retryCount: 0,
              lastError: String(e),
              scheduledAt: new Date(),
            },
          });
          return NextResponse.json({ success: true, recordId: taskRecord.id, status: "queued", message: "R2 transform prewarm failed. Task queued." }, { status: 202 });
        }
      } else {
        // 非 R2 URL：直接入队后台先下载再执行
        await prisma.processingQueue.create({
          data: {
            taskType: "sora2-video-watermark-removal",
            payload: { taskRecordId: taskRecord.id, userId, orientation, r2Url: url },
            status: "pending",
            retryCount: 0,
            lastError: 'non-R2-url',
            scheduledAt: new Date(),
          },
        });
        return NextResponse.json({ success: true, recordId: taskRecord.id, status: "queued", message: "Non-R2 URL. Task queued for background processing." }, { status: 202 });
      }

      // 8. 按横竖屏切换工作流与上传节点，同步创建 RunningHub 任务
      const workflowId = orientation === 'portrait' ? process.env.SORA2_PORTRAIT_WORKFLOW_ID : process.env.SORA2_LANDSCAPE_WORKFLOW_ID;
      
      if (!workflowId || workflowId === 'placeholder') {
        return NextResponse.json(
          { error: 'Sora2 workflow ID not configured. Please set SORA2_LANDSCAPE_WORKFLOW_ID and SORA2_PORTRAIT_WORKFLOW_ID environment variables.' },
          { status: 500 }
        );
      }
      const uploadNodeId = orientation === 'portrait' ? '153' : '205';
      const result = await createVideoTaskWithR2Url({
        model: 'sora2-video-watermark-removal',
        userId: userId,
        workflowId,
        uploadNodeId,
        uploadFieldName: 'video',
        r2Url: r2InputUrl,
      }, { repo, queue, rh });

      if (!result.ok) {
        return NextResponse.json({ 
          success: true, 
          recordId: result.recordId, 
          status: "queued", 
          message: "Task queued for background processing." 
        }, { status: 202 });
      }

      const runninghubTaskId = result.taskId;

      // 8. 更新任务记录
      await prisma.taskData.update({
        where: { id: taskRecord.id },
        data: {
          replicateId: runninghubTaskId,
          taskStatus: "processing",
        },
      });

      // 9. 开始状态监听
      taskQueueManager.startStatusWatcher(taskRecord.id, runninghubTaskId);

      // 10. 扣除积分
      await prisma.userCredit.update({
        where: { id: userCredit.id },
        data: { credit: { decrement: needCredit } },
      });

      return NextResponse.json({ 
        success: true, 
        taskId: runninghubTaskId, 
        recordId: taskRecord.id, 
        status: "processing" 
      });

    } catch (error: any) {
      console.error("同步创建任务失败:", error);
      
      // 如果是可重试的错误，加入队列
      if (error.message?.includes('TASK_QUEUE_MAXED') || 
          error.message?.includes('timeout') ||
          error.message?.includes('network')) {
        
        await prisma.processingQueue.create({
          data: {
            taskType: "sora2-video-watermark-removal",
            payload: { 
              taskRecordId: taskRecord.id, 
              userId, 
              orientation, 
              r2Url: url 
            },
            status: "pending",
            retryCount: 0,
            lastError: String(error),
            scheduledAt: new Date(),
          },
        });

        return NextResponse.json({ 
          success: true, 
          recordId: taskRecord.id, 
          status: "queued", 
          message: "Task queued for background processing." 
        }, { status: 202 });
      }

      // 其他错误直接返回失败
      await prisma.taskData.update({
        where: { id: taskRecord.id },
        data: {
          taskStatus: "failed",
          errorMsg: error instanceof Error ? error.message : "Failed to start task",
        },
      });

      return NextResponse.json({ 
        error: "Failed to create task", 
        details: String(error) 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Sora2 video watermark removal URL error:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: String(error) 
    }, { status: 500 });
  }
}

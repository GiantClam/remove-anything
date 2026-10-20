import { Credits, model } from "@/config/constants";
import { prisma } from "@/db/prisma";
import { BillingType } from "@/db/type";
import {
  ANALYTICS_EVENTS,
  createCreditsAnalyticsEvent,
  createTaskAnalyticsEvent,
  emitServerAnalyticsEvent,
} from "@/lib/analytics-events";
import { taskQueueManager } from "@/lib/task-queue";
import {
  ProviderTaskCreatedPersistenceError,
  resolveSora2VideoQueueMetadata,
  TransformReadinessQueueError,
} from "@/lib/video-task-queue-contract";
import { runninghubAPI } from "@/modules/runninghub";

export class TaskProcessor {
  private static instance: TaskProcessor;
  private isProcessing = false;

  private constructor() {}

  public static getInstance(): TaskProcessor {
    if (!TaskProcessor.instance) {
      TaskProcessor.instance = new TaskProcessor();
    }
    return TaskProcessor.instance;
  }

  /**
   * 处理视频去水印任务
   */
  public async processSora2VideoWatermarkRemoval(task: any) {
    const candidateTaskRecordId = Number(task?.metadata?.taskRecordId);
    let taskRecordId: number | undefined =
      Number.isSafeInteger(candidateTaskRecordId) && candidateTaskRecordId > 0
        ? candidateTaskRecordId
        : undefined;

    try {
      const {
        r2Url,
        transformUrl,
        shouldWaitForTransform,
        userId,
        workflowId,
        nodeInfoList,
        taskRecordId: resolvedTaskRecordId,
      } = resolveSora2VideoQueueMetadata(
        task.metadata ?? {},
        {
          landscape: process.env.SORA2_LANDSCAPE_WORKFLOW_ID,
          portrait: process.env.SORA2_PORTRAIT_WORKFLOW_ID,
        },
        process.env.R2_URL_BASE,
      );
      taskRecordId = resolvedTaskRecordId;

      console.log(`🚀 开始处理视频去水印任务: ${task.id}`);
      console.log(`📋 任务记录ID: ${taskRecordId}`);
      console.log(`🔗 R2 URL: ${r2Url}`);
      console.log(`🔗 Transform URL: ${transformUrl}`);

      // Only wait on transformations we generate for our configured R2 host.
      // External input URLs must not be fetched by the application server.
      if (shouldWaitForTransform) {
        const { waitForTransformReady } = await import("@/lib/cf-media");
        const ready = await waitForTransformReady(transformUrl, {
          timeoutMs: 120000,
          intervalMs: 1000,
        });
        if (!ready) {
          throw new TransformReadinessQueueError(
            "Media transform not ready within timeout",
          );
        }
      }

      // Mark the record active before crossing the provider boundary. If the
      // response is lost, it remains visible for reconciliation and is never
      // automatically submitted again.
      await prisma.taskData.update({
        where: { id: taskRecordId },
        data: { taskStatus: "Processing" },
      });
      await this.emitTaskLifecycleEvent(
        ANALYTICS_EVENTS.processingStarted,
        taskRecordId,
      );

      const runninghubTaskId = await runninghubAPI.createTaskGeneric({
        workflowId,
        nodeInfoList,
        taskRecordId,
        webhookRecordType: "video",
      });

      // A provider task now exists. A local persistence failure must not make
      // the durable queue retry creation and incur another paid task.
      try {
        await prisma.taskData.update({
          where: { id: taskRecordId },
          data: {
            taskStatus: "Processing",
            replicateId: runninghubTaskId,
          },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new ProviderTaskCreatedPersistenceError(
          taskRecordId,
          runninghubTaskId,
          `Provider task ${runninghubTaskId} was created but could not be linked to task record ${taskRecordId}: ${detail}`,
        );
      }

      try {
        const { taskQueueManager } = await import("./task-queue");
        taskQueueManager.startStatusWatcher(
          taskRecordId,
          runninghubTaskId,
          "video-watermark-removal",
        );
      } catch {}

      // 积分扣除（仅登录用户且非开发环境）
      if (userId && process.env.NODE_ENV !== "development") {
        try {
          const requiredCredits = Credits[model.sora2VideoWatermarkRemoval];
          await this.deductCredits(userId, requiredCredits, taskRecordId);
        } catch {}
      }

      console.log(
        `✅ 视频去水印任务 ${task.id} 已创建 RunningHub 任务: ${runninghubTaskId}`,
      );

      // 注意：这里不调用 completeTask，因为任务还在RunningHub中处理
      // 任务完成会通过webhook或状态轮询来处理
    } catch (error) {
      console.error(`❌ 处理视频去水印任务 ${task.id} 失败:`, error);

      const isUnknownProviderOutcome =
        (error as any)?.code === "TASK_CREATION_OUTCOME_UNKNOWN";
      const providerTaskWasCreated =
        error instanceof ProviderTaskCreatedPersistenceError;
      const isSafeReadinessRetry =
        error instanceof TransformReadinessQueueError &&
        Number(task?.retryCount ?? 0) === 0;

      if (error instanceof ProviderTaskCreatedPersistenceError) {
        try {
          await prisma.taskData.update({
            where: { id: error.taskRecordId },
            data: {
              taskStatus: "Processing",
              replicateId: error.providerTaskId,
              errorMsg: error.message,
            },
          });
        } catch {
          // The durable queue is failed below; reconciliation can still use
          // the provider's task ID from the error log without replaying create.
        }
      }

      // Unknown submission results and known-created tasks stay active for
      // reconciliation. A first typed readiness timeout is still eligible for
      // the cron's one safe retry, so it also remains non-final.
      if (
        taskRecordId &&
        !isUnknownProviderOutcome &&
        !providerTaskWasCreated &&
        !isSafeReadinessRetry
      ) {
        await prisma.taskData.update({
          where: { id: taskRecordId },
          data: {
            taskStatus: "failed",
            errorMsg: error instanceof Error ? error.message : String(error),
            executeEndTime: BigInt(Date.now()),
          },
        });
        await this.emitTaskLifecycleEvent(
          ANALYTICS_EVENTS.processingFailed,
          taskRecordId,
        );
      }
      throw error;
    }
  }

  /**
   * 处理图片去水印任务
   */
  public async processWatermarkRemoval(task: any) {
    // 实现图片去水印任务处理逻辑
    // 这里可以参考现有的图片去水印API实现
  }

  /**
   * 处理背景移除任务
   */
  public async processBackgroundRemoval(task: any) {
    // 实现背景移除任务处理逻辑
    // 这里可以参考现有的背景移除API实现
  }

  /**
   * 根据任务类型处理任务
   */
  public async processTask(task: any) {
    switch (task.taskType) {
      case "sora2-video-watermark-removal":
        await this.processSora2VideoWatermarkRemoval(task);
        break;
      case "watermark-removal":
        await this.processWatermarkRemoval(task);
        break;
      case "background-removal":
        await this.processBackgroundRemoval(task);
        break;
      default:
        console.error(`❌ 未知的任务类型: ${task.taskType}`);
        await taskQueueManager.failTask(
          task.id,
          new Error(`Unknown task type: ${task.taskType}`),
        );
    }
  }

  /**
   * 扣除积分的辅助函数
   */
  private async deductCredits(
    userId: string,
    requiredCredits: number,
    taskRecordId: number,
  ) {
    // 开发模式：跳过积分扣除
    if (process.env.NODE_ENV === "development") {
      console.log(`🔧 开发模式：跳过用户 ${userId} 的积分扣除`);
      return;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
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
        const transaction = await tx.userCreditTransaction.create({
          data: {
            userId,
            credit: -requiredCredits,
            balance: newCreditBalance,
            billingId: billing.id,
            type: "Sora2 Video Watermark Removal",
          },
        });
        return {
          transactionId: transaction.id,
          creditsBefore: userCredit.credit,
          creditsAfter: newCreditBalance,
        };
      });

      try {
        await emitServerAnalyticsEvent(
          createCreditsAnalyticsEvent(ANALYTICS_EVENTS.creditsConsumed, {
            transaction_id: result.transactionId,
            task_id: String(taskRecordId),
            user_id: userId,
            credits_before: result.creditsBefore,
            credits_after: result.creditsAfter,
            is_authenticated: true,
          }),
        );
      } catch (analyticsError) {
        console.warn("Credit consumption analytics failed:", analyticsError);
      }

      console.log(`✅ 用户 ${userId} 成功扣除 ${requiredCredits} 积分`);
    } catch (error) {
      console.error("❌ 积分扣除失败:", error);
      throw error;
    }
  }

  private async emitTaskLifecycleEvent(
    name: typeof ANALYTICS_EVENTS.processingStarted | typeof ANALYTICS_EVENTS.processingFailed,
    taskId: number,
  ) {
    try {
      await emitServerAnalyticsEvent(
        createTaskAnalyticsEvent(name, taskId, {
          is_authenticated: true,
        }),
      );
    } catch (analyticsError) {
      console.warn("Task lifecycle analytics failed:", analyticsError);
    }
  }
}

export const taskProcessor = TaskProcessor.getInstance();

import { prisma } from "@/db/prisma";
import { runninghubAPI } from "@/lib/runninghub-api";
import { taskQueueManager } from "@/lib/task-queue";
import { Credits, model } from "@/config/constants";
import { BillingType } from "@/db/type";

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
   * 处理Sora2视频去水印任务
   */
  public async processSora2VideoWatermarkRemoval(task: any) {
    const { taskRecordId, r2Url, transformUrl, orientation, userId } = task.metadata;
    
    try {
      console.log(`🚀 开始处理Sora2视频去水印任务: ${task.id}`);
      console.log(`📋 任务记录ID: ${taskRecordId}`);
      console.log(`🔗 R2 URL: ${r2Url}`);
      console.log(`🔗 Transform URL: ${transformUrl}`);

      if (!taskRecordId) {
        throw new Error("任务记录ID未找到");
      }

      // 等待变换就绪
      const { waitForTransformReady } = await import('@/lib/cf-media');
      const ready = await waitForTransformReady(transformUrl, { timeoutMs: 120000, intervalMs: 1000 });
      if (!ready) throw new Error('Media transform not ready within timeout');

      // 创建 RunningHub 任务
      let workflowId = process.env.SORA2_LANDSCAPE_WORKFLOW_ID;
      let nodeInfoList = [
        { nodeId: '205', fieldName: 'video', fieldValue: transformUrl }
      ];
      if (orientation === 'portrait'){
        workflowId = process.env.SORA2_PORTRAIT_WORKFLOW_ID;
        nodeInfoList = [
          { nodeId: '153', fieldName: 'video', fieldValue: transformUrl }
        ];
      }
      
      if (!workflowId || workflowId === 'placeholder') {
        throw new Error('Sora2 workflow ID not configured. Please set SORA2_LANDSCAPE_WORKFLOW_ID and SORA2_PORTRAIT_WORKFLOW_ID environment variables.');
      }

      

      const runninghubTaskId = await runninghubAPI.createTaskGeneric({
        workflowId,
        nodeInfoList,
        taskRecordId,
      });

      // 更新记录并启动状态监控
      await prisma.fluxData.update({
        where: { id: taskRecordId },
        data: {
          taskStatus: "processing",
          replicateId: runninghubTaskId,
        },
      });

      try {
        const { taskQueueManager } = await import('./task-queue');
        taskQueueManager.startStatusWatcher(taskRecordId, runninghubTaskId);
      } catch {}

      // 积分扣除（仅登录用户且非开发环境）
      if (userId && process.env.NODE_ENV !== 'development') {
        try {
          const requiredCredits = Credits[model.sora2VideoWatermarkRemoval];
          await this.deductCredits(userId, requiredCredits, taskRecordId);
        } catch {}
      }

      console.log(`✅ Sora2视频去水印任务 ${task.id} 已创建 RunningHub 任务: ${runninghubTaskId}`);

      // 注意：这里不调用 completeTask，因为任务还在RunningHub中处理
      // 任务完成会通过webhook或状态轮询来处理

    } catch (error) {
      console.error(`❌ 处理Sora2视频去水印任务 ${task.id} 失败:`, error);
      
      // 更新任务状态为失败
      if (taskRecordId) {
        await prisma.fluxData.update({
          where: { id: taskRecordId },
          data: {
            taskStatus: "Failed",
            errorMsg: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }

      // 标记队列任务失败
      await taskQueueManager.failTask(task.id, error);
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
        await taskQueueManager.failTask(task.id, new Error(`Unknown task type: ${task.taskType}`));
    }
  }

  /**
   * 扣除积分的辅助函数
   */
  private async deductCredits(userId: string, requiredCredits: number, taskRecordId: number) {
    // 开发模式：跳过积分扣除
    if (process.env.NODE_ENV === "development") {
      console.log(`🔧 开发模式：跳过用户 ${userId} 的积分扣除`);
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
}

export const taskProcessor = TaskProcessor.getInstance();

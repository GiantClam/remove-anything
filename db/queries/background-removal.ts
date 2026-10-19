import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

export interface CreateBackgroundRemovalTaskData {
  userId?: string;
  principalId?: string;
  replicateId: string;
  inputImageUrl: string;
  resolution?: string;
  model?: string;
  idempotencyKey?: string;
}

export interface UpdateBackgroundRemovalTaskData {
  taskStatus?: string;
  outputImageUrl?: string;
  errorMsg?: string;
  executeStartTime?: bigint;
  executeEndTime?: bigint;
  expiresAt?: Date;
  retryCount?: number;
}

/**
 * 创建背景移除任务
 */
export async function createBackgroundRemovalTask(data: CreateBackgroundRemovalTaskData) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过创建背景移除任务");
    return { id: 1, replicateId: data.replicateId };
  }

  try {
    const taskData: any = {
      replicateId: data.replicateId,
      inputImageUrl: data.inputImageUrl,
      resolution: data.resolution || "1024x1024",
      model: data.model || "men1scus/birefnet",
      taskStatus: "pending",
      userId: data.userId || null, // 显式设置为null而不是undefined
      principalId: data.principalId || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      idempotencyKey: data.idempotencyKey || null,
    };

    const task = await prisma.backgroundRemovalTask.create({
      data: taskData
    });

    console.log("✅ 背景移除任务创建成功:", task.id);
    return task;
  } catch (error) {
    console.error("❌ 创建背景移除任务失败:", error);
    throw error;
  }
}

/**
 * 根据Replicate ID查找任务
 */
export async function findBackgroundRemovalTaskByReplicateId(replicateId: string) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过查找背景移除任务");
    return null;
  }

  try {
    const task = await prisma.backgroundRemovalTask.findFirst({
      where: { replicateId }
    });

    return task;
  } catch (error) {
    console.error("❌ 查找背景移除任务失败:", error);
    throw error;
  }
}

/**
 * 更新背景移除任务状态
 */
export async function updateBackgroundRemovalTask(
  replicateId: string, 
  data: UpdateBackgroundRemovalTaskData
) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过更新背景移除任务");
    return null;
  }

  try {
    const task = await prisma.backgroundRemovalTask.update({
      where: { replicateId },
      data
    });

    console.log("✅ 背景移除任务更新成功:", task.id);
    return task;
  } catch (error) {
    console.error("❌ 更新背景移除任务失败:", error);
    throw error;
  }
}

/**
 * 获取用户的任务列表
 */
export async function getUserBackgroundRemovalTasks(userId: string, limit = 20) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过获取用户背景移除任务");
    return [];
  }

  try {
    const tasks = await prisma.backgroundRemovalTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return tasks;
  } catch (error) {
    console.error("❌ 获取用户背景移除任务失败:", error);
    throw error;
  }
}

/**
 * 获取任务统计信息
 */
export async function getBackgroundRemovalTaskStats(userId: string) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过获取任务统计");
    return { total: 0, completed: 0, failed: 0, pending: 0 };
  }

  try {
    const [total, completed, failed, pending] = await Promise.all([
      prisma.backgroundRemovalTask.count({ where: { userId } }),
      prisma.backgroundRemovalTask.count({ 
        where: { userId, taskStatus: "succeeded" } 
      }),
      prisma.backgroundRemovalTask.count({ 
        where: { userId, taskStatus: "failed" } 
      }),
      prisma.backgroundRemovalTask.count({ 
        where: { userId, taskStatus: { in: ["pending", "starting", "processing"] } } 
      })
    ]);

    return { total, completed, failed, pending };
  } catch (error) {
    console.error("❌ 获取任务统计失败:", error);
    throw error;
  }
}

/**
 * 增加下载次数
 */
export async function incrementDownloadCount(taskId: number) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过增加下载次数");
    return;
  }

  try {
    await prisma.backgroundRemovalTask.update({
      where: { id: taskId },
      data: {
        downloadCount: { increment: 1 }
      }
    });
  } catch (error) {
    console.error("❌ 增加下载次数失败:", error);
    throw error;
  }
}

/**
 * 增加查看次数
 */
export async function incrementViewCount(taskId: number) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过增加查看次数");
    return;
  }

  try {
    await prisma.backgroundRemovalTask.update({
      where: { id: taskId },
      data: {
        viewCount: { increment: 1 }
      }
    });
  } catch (error) {
    console.error("❌ 增加查看次数失败:", error);
    throw error;
  }
}

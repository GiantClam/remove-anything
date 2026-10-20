import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

export interface CreateWatermarkRemovalTaskData {
  userId?: string;
  principalId?: string;
  runninghubTaskId: string;
  inputZipUrl: string;
  idempotencyKey?: string;
  authorizationConfirmed?: boolean;
  authorizationPolicyVersion?: string;
  authorizationSubject?: string;
  authorizationConfirmedAt?: Date;
}

export interface UpdateWatermarkRemovalTaskData {
  runninghubTaskId?: string;
  inputZipUrl?: string;
  taskStatus?: string;
  outputZipUrl?: string;
  executeStartTime?: bigint;
  executeEndTime?: bigint;
  errorMsg?: string;
}

/**
 * 创建去水印任务
 */
export async function createWatermarkRemovalTask(data: CreateWatermarkRemovalTaskData) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过创建去水印任务");
    return { id: 1, runninghubTaskId: data.runninghubTaskId };
  }

  try {
    const taskData: any = {
      runninghubTaskId: data.runninghubTaskId,
      inputZipUrl: data.inputZipUrl,
      taskStatus: "pending",
      userId: data.userId || null,
      principalId: data.principalId || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      idempotencyKey: data.idempotencyKey || null,
      authorizationConfirmed: Boolean(data.authorizationConfirmed),
      authorizationPolicyVersion: data.authorizationPolicyVersion || null,
      authorizationSubject: data.authorizationSubject || null,
      authorizationConfirmedAt: data.authorizationConfirmedAt || null,
      auditExpiresAt: data.authorizationConfirmed
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        : null,
    };

    const task = await prisma.watermarkRemovalTask.create({
      data: taskData
    });

    console.log("✅ 去水印任务创建成功:", task.id);
    return task;
  } catch (error) {
    console.error("❌ 创建去水印任务失败:", error);
    throw error;
  }
}

/**
 * 根据RunningHub任务ID查找任务
 */
export async function findWatermarkRemovalTaskByRunningHubId(runninghubTaskId: string) {
  console.log("🔍 开始查找去水印任务:", runninghubTaskId);
  
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过查找去水印任务");
    return null;
  }

  try {
    console.log("🔍 执行数据库查询，runninghubTaskId:", runninghubTaskId);
    const task = await prisma.watermarkRemovalTask.findUnique({
      where: { runninghubTaskId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    console.log("🔍 数据库查询结果:", task ? "找到任务" : "未找到任务");
    return task;
  } catch (error) {
    console.error("❌ 查找去水印任务失败:", error);
    throw error;
  }
}

/**
 * 更新去水印任务
 */
export async function updateWatermarkRemovalTask(taskId: number, data: UpdateWatermarkRemovalTaskData) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过更新去水印任务");
    return { id: taskId };
  }

  try {
    const task = await prisma.watermarkRemovalTask.update({
      where: { id: taskId },
      data: data
    });

    console.log("✅ 去水印任务更新成功:", task.id);
    return task;
  } catch (error) {
    console.error("❌ 更新去水印任务失败:", error);
    throw error;
  }
}

/**
 * 根据ID查找去水印任务
 */
export async function findWatermarkRemovalTaskById(id: number) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过查找去水印任务");
    return null;
  }

  try {
    const task = await prisma.watermarkRemovalTask.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    return task;
  } catch (error) {
    console.error("❌ 查找去水印任务失败:", error);
    throw error;
  }
}

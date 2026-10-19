import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

export interface CreateObjectRemovalTaskData {
  userId?: string;
  principalId?: string;
  runninghubTaskId: string;
  inputImageUrl: string;
  inputMaskUrl: string;
  detectPrompt?: string;
  idempotencyKey?: string;
  authorizationConfirmed?: boolean;
  authorizationPolicyVersion?: string;
  authorizationSubject?: string;
  authorizationConfirmedAt?: Date;
}

export interface UpdateObjectRemovalTaskData {
  runninghubTaskId?: string;
  taskStatus?: string;
  outputImageUrl?: string | null;
  errorMsg?: string | null;
  executeStartTime?: bigint;
  executeEndTime?: bigint;
}

export async function createObjectRemovalTask(data: CreateObjectRemovalTaskData) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过创建删物任务");
    return { id: 1, runninghubTaskId: data.runninghubTaskId };
  }

  return prisma.objectRemovalTask.create({
    data: {
      userId: data.userId || null,
      principalId: data.principalId || null,
      runninghubTaskId: data.runninghubTaskId,
      inputImageUrl: data.inputImageUrl,
      inputMaskUrl: data.inputMaskUrl,
      detectPrompt: data.detectPrompt || null,
      taskStatus: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      idempotencyKey: data.idempotencyKey || null,
      authorizationConfirmed: Boolean(data.authorizationConfirmed),
      authorizationPolicyVersion: data.authorizationPolicyVersion || null,
      authorizationSubject: data.authorizationSubject || null,
      authorizationConfirmedAt: data.authorizationConfirmedAt || null,
      auditExpiresAt: data.authorizationConfirmed
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        : null,
    },
  });
}

export async function findObjectRemovalTaskByRunningHubId(runninghubTaskId: string) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过查找删物任务");
    return null;
  }

  return prisma.objectRemovalTask.findUnique({
    where: { runninghubTaskId },
  });
}

export async function updateObjectRemovalTask(taskId: number, data: UpdateObjectRemovalTaskData) {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过更新删物任务");
    return { id: taskId };
  }

  return prisma.objectRemovalTask.update({
    where: { id: taskId },
    data,
  });
}

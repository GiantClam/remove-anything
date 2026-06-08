import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

export interface CreateObjectRemovalTaskData {
  userId?: string;
  runninghubTaskId: string;
  inputImageUrl: string;
  inputMaskUrl: string;
  detectPrompt?: string;
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
      runninghubTaskId: data.runninghubTaskId,
      inputImageUrl: data.inputImageUrl,
      inputMaskUrl: data.inputMaskUrl,
      detectPrompt: data.detectPrompt || null,
      taskStatus: "pending",
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

import { prisma } from "@/db/prisma";
import { withRetry } from "@/lib/db-connection";
import type { CreateTaskParams, TaskRecord, TaskRepository } from "../sdk";

// 默认实现针对任务数据（用于视频去水印等任务）
export function createPrismaTaskRepository(): TaskRepository {
  return {
    async create(data: CreateTaskParams & { status?: string }): Promise<TaskRecord> {
      const rec = await withRetry(async () => {
        return await prisma.taskData.create({
          data: {
            userId: data.userId || "",
            model: data.model,
            inputPrompt: data.inputUrl || null,
            imageUrl: null,
            taskStatus: data.status || 'processing',
            executeStartTime: BigInt(Date.now()),
            executeEndTime: null,
            replicateId: '',
            isPrivate: true,
            aspectRatio: "1:1", // 必需字段
          },
        });
      });
      return {
        id: rec.id,
        userId: rec.userId || undefined,
        model: rec.model,
        status: rec.taskStatus,
        inputUrl: rec.inputPrompt || undefined,
        outputUrl: rec.imageUrl || undefined,
        externalTaskId: rec.replicateId || undefined,
        errorMsg: rec.errorMsg || undefined,
      };
    },
    async update(id, data): Promise<void> {
      // 确保状态格式正确（数据库使用 "Succeeded", "Failed", "Processing"）
      const taskStatus = data.status === "succeeded" ? "Succeeded"
                      : data.status === "failed" ? "Failed"
                      : data.status === "processing" ? "Processing"
                      : data.status === "queued" ? "Processing"
                      : data.status === "pending" ? "Processing"
                      : data.status || "Processing";
      
      await withRetry(async () => {
        await prisma.taskData.update({
          where: { id: typeof id === "number" ? id : parseInt(String(id)) },
          data: {
            taskStatus: taskStatus,
            imageUrl: data.outputUrl ?? undefined,
            replicateId: data.externalTaskId ?? undefined,
            errorMsg: data.errorMsg ?? undefined,
            executeEndTime: taskStatus === "Succeeded" || taskStatus === "Failed" 
              ? BigInt(Date.now()) 
              : undefined,
          },
        });
      });
    },
    async findByExternalId(model: string, externalId: string): Promise<TaskRecord | null> {
      const rec = await withRetry(async () => {
        return await prisma.taskData.findFirst({ where: { model, replicateId: externalId } });
      });
      if (!rec) return null;
      return {
        id: rec.id,
        userId: rec.userId || undefined,
        model: rec.model,
        status: rec.taskStatus,
        inputUrl: rec.inputPrompt || undefined,
        outputUrl: rec.imageUrl || undefined,
        externalTaskId: rec.replicateId || undefined,
        errorMsg: rec.errorMsg || undefined,
      };
    }
  };
}

import { prisma } from "@/db/prisma";
import type { CreateTaskParams, TaskRecord, TaskRepository } from "../sdk";

// 默认实现针对任务数据（用于视频去水印等任务）
export function createPrismaTaskRepository(): TaskRepository {
  return {
    async create(data: CreateTaskParams & { status?: string }): Promise<TaskRecord> {
      const rec = await prisma.taskData.create({
        data: {
          userId: data.userId || null,
          model: data.model,
          r2Url: data.inputUrl || null,
          imageUrl: null,
          taskStatus: data.status || 'processing',
          executeStartTime: BigInt(Date.now()),
          executeEndTime: null,
          replicateId: '',
          isPrivate: true,
        } as any,
      });
      return {
        id: rec.id,
        userId: rec.userId || undefined,
        model: rec.model,
        status: rec.taskStatus,
        inputUrl: rec.r2Url || undefined,
        outputUrl: rec.imageUrl || undefined,
        externalTaskId: rec.replicateId || undefined,
        errorMsg: rec.errorMsg || undefined,
      };
    },
    async update(id, data): Promise<void> {
      await prisma.taskData.update({
        where: { id: id as number },
        data: {
          taskStatus: data.status,
          imageUrl: data.outputUrl ?? undefined,
          replicateId: data.externalTaskId ?? undefined,
          errorMsg: data.errorMsg ?? undefined,
          executeEndTime: data.status && ['succeeded','failed'].includes(data.status) ? BigInt(Date.now()) : undefined,
        } as any,
      });
    },
    async findByExternalId(model: string, externalId: string): Promise<TaskRecord | null> {
      const rec = await prisma.taskData.findFirst({ where: { model, replicateId: externalId } });
      if (!rec) return null;
      return {
        id: rec.id,
        userId: rec.userId || undefined,
        model: rec.model,
        status: rec.taskStatus,
        inputUrl: rec.r2Url || undefined,
        outputUrl: rec.imageUrl || undefined,
        externalTaskId: rec.replicateId || undefined,
        errorMsg: rec.errorMsg || undefined,
      };
    }
  };
}



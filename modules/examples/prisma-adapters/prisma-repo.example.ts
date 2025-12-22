/**
 * Prisma TaskRepository 适配器示例
 * 
 * 这是一个示例实现，展示如何为 Tasks 模块创建 Prisma 适配器。
 * 你需要根据你的数据库模型调整实现。
 * 
 * 使用方式：
 * ```ts
 * import { PrismaClient } from '@prisma/client';
 * import { createPrismaTaskRepository } from './prisma-repo.example';
 * 
 * const prisma = new PrismaClient();
 * const repo = createPrismaTaskRepository(prisma);
 * ```
 */

import type { PrismaClient } from '@prisma/client';
import type { CreateTaskParams, TaskRecord, TaskRepository } from '../../tasks/sdk';

/**
 * 创建基于 Prisma 的 TaskRepository 实现
 * 
 * 注意：此示例假设你的 Prisma schema 中有类似以下的结构：
 * - model TaskData {
 *     id            Int
 *     userId        String?
 *     model         String
 *     r2Url         String?
 *     imageUrl      String?
 *     taskStatus    String
 *     replicateId  String?
 *     errorMsg      String?
 *     ...
 *   }
 * 
 * 你需要根据实际的数据模型调整字段映射。
 */
export function createPrismaTaskRepository(prisma: PrismaClient): TaskRepository {
  return {
    async create(data: CreateTaskParams & { status?: string }): Promise<TaskRecord> {
      // 根据你的 Prisma schema 调整这里的实现
      const rec = await (prisma as any).taskData.create({
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
        },
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
      await (prisma as any).taskData.update({
        where: { id: id as number },
        data: {
          taskStatus: data.status,
          imageUrl: data.outputUrl ?? undefined,
          replicateId: data.externalTaskId ?? undefined,
          errorMsg: data.errorMsg ?? undefined,
          executeEndTime: data.status && ['succeeded', 'failed'].includes(data.status) 
            ? BigInt(Date.now()) 
            : undefined,
        },
      });
    },
    
    async findByExternalId(model: string, externalId: string): Promise<TaskRecord | null> {
      const rec = await (prisma as any).taskData.findFirst({ 
        where: { model, replicateId: externalId } 
      });
      
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
    },
  };
}


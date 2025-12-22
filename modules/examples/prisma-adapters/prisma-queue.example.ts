/**
 * Prisma TaskQueue 适配器示例
 * 
 * 这是一个示例实现，展示如何为 Tasks 模块创建 Prisma 队列适配器。
 * 
 * 使用方式：
 * ```ts
 * import { PrismaClient } from '@prisma/client';
 * import { createPrismaTaskQueue } from './prisma-queue.example';
 * 
 * const prisma = new PrismaClient();
 * const queue = createPrismaTaskQueue(prisma);
 * ```
 */

import type { PrismaClient } from '@prisma/client';
import type { TaskQueue } from '../../tasks/sdk';

/**
 * 创建基于 Prisma 的 TaskQueue 实现
 * 
 * 注意：此示例假设你的 Prisma schema 中有类似以下的结构：
 * - model ProcessingQueue {
 *     id        Int
 *     taskType  String
 *     payload   Json
 *     status    String
 *     ...
 *   }
 * 
 * 你需要根据实际的数据模型调整实现。
 */
export function createPrismaTaskQueue(prisma: PrismaClient): TaskQueue {
  return {
    async enqueue(taskType: string, payload: Record<string, any>): Promise<void> {
      await (prisma as any).processingQueue.create({
        data: {
          taskType,
          payload,
          status: 'pending',
        },
      });
    },
  };
}


import { prisma } from "@/db/prisma";
import type { TaskQueue } from "../sdk";

export function createPrismaTaskQueue(): TaskQueue {
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



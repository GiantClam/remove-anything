import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { taskProcessor } from "@/lib/task-processor";

function computeBackoffMs(retryCount: number): number {
  const steps = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
  return steps[Math.min(retryCount, steps.length - 1)];
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const batchSize = Number(process.env.QUEUE_BATCH_SIZE || 5);

  // 认领任务
  const now = new Date();
  const tasks = await (prisma as any).processingQueue.findMany({
    where: { status: 'pending', scheduledAt: { lte: now } },
    take: batchSize,
    orderBy: { createdAt: 'asc' },
  });

  let processed = 0;
  for (const t of tasks) {
    // 标记为 running
    await (prisma as any).processingQueue.update({
      where: { id: t.id },
      data: { status: 'running' },
    });

    try {
      if (t.taskType === 'sora2-video-watermark-removal') {
        await taskProcessor.processSora2VideoWatermarkRemoval({ metadata: t.payload, id: `cron_${t.id}` });
      }
      await (prisma as any).processingQueue.update({ where: { id: t.id }, data: { status: 'completed' } });
      processed++;
    } catch (e: any) {
      const nextDelay = computeBackoffMs(t.retryCount || 0);
      await (prisma as any).processingQueue.update({
        where: { id: t.id },
        data: {
          status: 'pending',
          retryCount: (t.retryCount || 0) + 1,
          lastError: String(e?.message || e),
          scheduledAt: new Date(Date.now() + nextDelay),
        },
      });
    }
  }

  return NextResponse.json({ processed });
}



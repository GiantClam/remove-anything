export async function register() {
  // Only enable Sentry instrumentation in production with valid DSN
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config');
    }
  }

  // 启动时恢复未完成的任务监控（容错）
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      const { prisma } = await import('@/db/prisma');
      const { taskQueueManager } = await import('@/lib/task-queue');

      const pending = await prisma.taskData.findMany({
        where: {
          model: 'sora2-video-watermark-removal',
          taskStatus: { in: ['processing', 'Processing'] },
          replicateId: { not: null }
        },
        select: { id: true, replicateId: true }
      });

      for (const t of pending) {
        if (t.replicateId) {
          taskQueueManager.startStatusWatcher(t.id, t.replicateId, "video-watermark-removal");
        }
      }
    }
  } catch {}
}

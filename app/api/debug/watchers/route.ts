import { NextResponse } from 'next/server';
import { taskQueueManager } from '@/lib/task-queue';

export async function GET() {
  try {
    const watchers = taskQueueManager.getActiveWatchers();
    
    return NextResponse.json({
      success: true,
      watchers,
      message: `当前有 ${watchers.count} 个活跃的状态监控`
    });
  } catch (error) {
    console.error('❌ 获取监控状态失败:', error);
    return NextResponse.json(
      { error: 'Failed to get watcher status' },
      { status: 500 }
    );
  }
}

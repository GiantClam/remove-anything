import { NextRequest, NextResponse } from "next/server";
import { taskQueueManager } from "@/lib/task-queue";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (taskId) {
      // 获取特定任务的位置
      const position = taskQueueManager.getTaskPosition(taskId);
      
      if (position === null) {
        return NextResponse.json({ 
          error: "Task not found" 
        }, { status: 404 });
      }

      return NextResponse.json({
        taskId,
        position,
        status: position === 0 ? 'running' : 'queued',
        message: position === 0 
          ? '任务正在运行中' 
          : `任务在队列中，当前排队位置: ${position}`
      });
    } else {
      // 获取整体队列状态
      const status = taskQueueManager.getQueueStatus();
      
      return NextResponse.json({
        ...status,
        message: `当前运行中: ${status.running}/${status.maxConcurrent}, 排队中: ${status.pending}`
      });
    }
  } catch (error) {
    console.error('❌ 获取队列状态失败:', error);
    return NextResponse.json({ 
      error: "Failed to get queue status" 
    }, { status: 500 });
  }
}

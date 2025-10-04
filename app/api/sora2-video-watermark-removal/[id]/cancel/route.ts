import { NextRequest, NextResponse } from "next/server";
import { taskQueueManager } from "@/lib/task-queue";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    console.log(`🚫 用户请求取消任务: ${taskId}`);

    // 取消任务
    const success = await taskQueueManager.cancelTask(taskId);
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "任务已取消" 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "任务不存在或无法取消" 
      }, { status: 404 });
    }

  } catch (error) {
    console.error("❌ 取消任务失败:", error);
    return NextResponse.json({ 
      error: "取消任务失败" 
    }, { status: 500 });
  }
}

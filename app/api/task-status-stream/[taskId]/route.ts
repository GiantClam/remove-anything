import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const taskId = params.taskId;
  
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  // 设置 SSE 响应头
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      let intervalId: NodeJS.Timeout;
      let attempts = 0;
      const maxAttempts = 120; // 20分钟
      
      const checkTaskStatus = async () => {
        try {
          attempts++;
          
          // 查询任务状态
          const taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
          
          if (!taskRecord) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: "Task not found",
              status: "error" 
            })}\n\n`));
            controller.close();
            return;
          }

          const statusData = {
            taskId: taskId,
            status: taskRecord.taskStatus,
            output: taskRecord.outputImageUrl,
            error: taskRecord.errorMsg,
            attempts: attempts,
            maxAttempts: maxAttempts
          };

          // 发送状态更新
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusData)}\n\n`));

          // 如果任务完成或失败，关闭连接
          if (taskRecord.taskStatus === 'succeeded' || taskRecord.taskStatus === 'failed') {
            console.log(`✅ SSE 任务完成: ${taskId} -> ${taskRecord.taskStatus}`);
            clearInterval(intervalId);
            controller.close();
            return;
          }

          // 如果超过最大尝试次数，关闭连接
          if (attempts >= maxAttempts) {
            console.log(`⏰ SSE 超时: ${taskId}`);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: "Task timeout",
              status: "timeout" 
            })}\n\n`));
            clearInterval(intervalId);
            controller.close();
            return;
          }

        } catch (error) {
          console.error(`❌ SSE 检查任务状态失败: ${taskId}`, error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            error: "Check failed",
            status: "error" 
          })}\n\n`));
        }
      };

      // 立即检查一次
      checkTaskStatus();
      
      // 然后每3秒检查一次
      intervalId = setInterval(checkTaskStatus, 3000);

      // 处理客户端断开连接
      req.signal?.addEventListener('abort', () => {
        console.log(`🔌 SSE 客户端断开连接: ${taskId}`);
        clearInterval(intervalId);
        controller.close();
      });
    }
  });

  return new Response(stream, { headers });
}

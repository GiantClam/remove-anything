import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { aiGateway } from "@/lib/ai-gateway";
import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";
import { prisma } from "@/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    console.log("🔍 查询任务状态:", taskId);

    // 首先从数据库查询任务记录
    const taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
    
    if (!taskRecord) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 如果任务还在进行中，从Replicate获取最新状态
    if (['pending', 'starting', 'processing'].includes(taskRecord.taskStatus)) {
      try {
        const replicateStatus = await aiGateway.getTaskStatus(taskId);
        
        // 同步数据库状态与Replicate状态
        let updateData: any = {};
        let finalStatus = replicateStatus.status;
        
        switch (replicateStatus.status) {
          case 'starting':
            if (taskRecord.taskStatus === 'pending') {
              updateData = {
                taskStatus: 'starting',
                executeStartTime: BigInt(Date.now())
              };
            }
            break;
            
          case 'processing':
            updateData = {
              taskStatus: 'processing'
            };
            break;
            
          case 'succeeded':
            const imageUrl = Array.isArray(replicateStatus.output) ? replicateStatus.output[0] : replicateStatus.output;
            updateData = {
              taskStatus: 'succeeded',
              outputImageUrl: imageUrl,
              executeEndTime: BigInt(Date.now())
            };
            break;
            
          case 'failed':
          case 'canceled':
            updateData = {
              taskStatus: 'failed',
              executeEndTime: BigInt(Date.now()),
              errorMsg: replicateStatus.error?.message || replicateStatus.error || 'Task failed'
            };
            break;
        }
        
        // 更新数据库状态
        if (Object.keys(updateData).length > 0) {
          try {
            await prisma.backgroundRemovalTask.update({
              where: { replicateId: taskId },
              data: updateData
            });
            console.log(`🔄 已同步数据库状态: ${taskId} -> ${updateData.taskStatus}`);
          } catch (dbError) {
            console.error("❌ 数据库状态更新失败:", dbError);
          }
        }
        
        return NextResponse.json({
          success: true,
          taskId: taskId,
          status: replicateStatus.status,
          output: replicateStatus.output,
          error: replicateStatus.error,
          logs: replicateStatus.logs,
          urls: replicateStatus.urls,
          createdAt: replicateStatus.created_at,
          startedAt: replicateStatus.started_at,
          completedAt: replicateStatus.completed_at,
          // 数据库记录信息
          taskRecordId: taskRecord.id,
          inputImageUrl: taskRecord.inputImageUrl,
          outputImageUrl: updateData.outputImageUrl || taskRecord.outputImageUrl,
          dbTaskStatus: updateData.taskStatus || taskRecord.taskStatus
        });
      } catch (replicateError) {
        console.error("❌ 从Replicate获取状态失败:", replicateError);
        // 如果Replicate查询失败，返回数据库中的状态
        return NextResponse.json({
          success: true,
          taskId: taskId,
          status: taskRecord.taskStatus,
          output: taskRecord.outputImageUrl,
          error: taskRecord.errorMsg,
          // 数据库记录信息
          taskRecordId: taskRecord.id,
          inputImageUrl: taskRecord.inputImageUrl,
          outputImageUrl: taskRecord.outputImageUrl,
          dbTaskStatus: taskRecord.taskStatus,
          createdAt: taskRecord.createdAt,
          executeStartTime: taskRecord.executeStartTime,
          executeEndTime: taskRecord.executeEndTime
        });
      }
    } else {
      // 任务已完成，直接返回数据库中的状态
      return NextResponse.json({
        success: true,
        taskId: taskId,
        status: taskRecord.taskStatus,
        output: taskRecord.outputImageUrl,
        error: taskRecord.errorMsg,
        // 数据库记录信息
        taskRecordId: taskRecord.id,
        inputImageUrl: taskRecord.inputImageUrl,
        outputImageUrl: taskRecord.outputImageUrl,
        dbTaskStatus: taskRecord.taskStatus,
        createdAt: taskRecord.createdAt,
        executeStartTime: taskRecord.executeStartTime,
        executeEndTime: taskRecord.executeEndTime
      });
    }

  } catch (error) {
    console.error("❌ 查询任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

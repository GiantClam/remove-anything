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
        console.log(`🔍 任务状态为 ${taskRecord.taskStatus}，从Replicate获取最新状态...`);
        const replicateStatus = await aiGateway.getTaskStatus(taskId);
        
        console.log(`📊 Replicate状态: ${replicateStatus.status}, 数据库状态: ${taskRecord.taskStatus}`);
        
        // 同步数据库状态与Replicate状态
        let updateData: any = {};
        let finalStatus = replicateStatus.status;
        
        switch (replicateStatus.status) {
          case 'starting':
            // 如果数据库状态是pending，更新为starting
            if (taskRecord.taskStatus === 'pending') {
              updateData = {
                taskStatus: 'starting',
                executeStartTime: BigInt(Date.now())
              };
            }
            // 如果数据库状态已经是starting，不需要更新
            break;
            
          case 'processing':
            // 无论数据库状态是什么，都更新为processing
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
            console.log(`✅ 任务成功完成，输出URL: ${imageUrl}`);
            break;
            
          case 'failed':
          case 'canceled':
            updateData = {
              taskStatus: 'failed',
              executeEndTime: BigInt(Date.now()),
              errorMsg: replicateStatus.error?.message || replicateStatus.error || 'Task failed'
            };
            console.log(`❌ 任务失败: ${updateData.errorMsg}`);
            break;
        }
        
        console.log(`🔄 需要更新的数据:`, updateData);
        
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
        } else {
          console.log(`ℹ️ 无需更新数据库状态`);
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
          dbTaskStatus: updateData.taskStatus || taskRecord.taskStatus,
          // 修复BigInt序列化问题
          executeStartTime: taskRecord.executeStartTime ? taskRecord.executeStartTime.toString() : null,
          executeEndTime: taskRecord.executeEndTime ? taskRecord.executeEndTime.toString() : null
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
          executeStartTime: taskRecord.executeStartTime ? taskRecord.executeStartTime.toString() : null,
          executeEndTime: taskRecord.executeEndTime ? taskRecord.executeEndTime.toString() : null
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
        executeStartTime: taskRecord.executeStartTime ? taskRecord.executeStartTime.toString() : null,
        executeEndTime: taskRecord.executeEndTime ? taskRecord.executeEndTime.toString() : null
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

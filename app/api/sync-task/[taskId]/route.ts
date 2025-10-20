import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";
import { runninghubAPI } from "@/lib/runninghub-api";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const taskId = params.taskId;
  
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  try {
    console.log(`🔄 手动同步任务: ${taskId}`);
    
    // 查询任务记录
    const taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
    
    if (!taskRecord) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log(`📋 任务记录状态: ${taskRecord.taskStatus}`);

    // 如果任务已经完成，直接返回
    if (taskRecord.taskStatus === 'succeeded' || taskRecord.taskStatus === 'failed') {
      return NextResponse.json({
        success: true,
        message: "Task already completed",
        taskId: taskId,
        status: taskRecord.taskStatus,
        output: taskRecord.outputImageUrl,
        error: taskRecord.errorMsg
      });
    }

    // 检查 RunningHub 状态
    console.log(`🔍 查询 RunningHub 状态: ${taskId}`);
    const statusResp = await runninghubAPI.getTaskStatus(taskId);
    console.log(`📡 RunningHub 状态响应:`, JSON.stringify(statusResp, null, 2));
    
    let status: string | undefined;
    if (statusResp && typeof statusResp === 'object') {
      if (statusResp.code === 0 && statusResp.data) {
        if (typeof statusResp.data === 'string') {
          status = statusResp.data;
        } else if (statusResp.data && typeof statusResp.data.status === 'string') {
          status = statusResp.data.status;
        }
      }
    }
    
    console.log(`📊 解析的 RunningHub 状态: ${status}`);

    let updateData: any = {};
    let message = "";

    if (status === 'SUCCESS' || status === 'succeeded') {
      // 获取结果并更新数据库
      console.log(`🎯 任务成功，获取结果: ${taskId}`);
      const result = await runninghubAPI.getTaskResult(taskId);
      let outputUrl: string | null = null;
      
      if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
        outputUrl = result.data[0]?.fileUrl || null;
      }
      
      updateData = {
        taskStatus: 'succeeded',
        outputImageUrl: outputUrl,
        executeEndTime: BigInt(Date.now())
      };
      
      message = "Task synchronized successfully";
      console.log(`✅ 任务成功同步: ${taskId} -> succeeded`);
      
    } else if (status === 'FAILED' || status === 'failed') {
      updateData = {
        taskStatus: 'failed',
        executeEndTime: BigInt(Date.now()),
        errorMsg: 'Task failed on RunningHub'
      };
      
      message = "Task failed on RunningHub";
      console.log(`❌ 任务失败同步: ${taskId} -> failed`);
      
    } else if (status === 'RUNNING' || status === 'running' || status === 'Processing' || status === 'processing') {
      updateData = {
        taskStatus: 'processing',
        executeStartTime: BigInt(Date.now())
      };
      
      message = "Task is still running";
      console.log(`🔄 任务仍在运行: ${taskId} -> processing`);
      
    } else {
      return NextResponse.json({
        success: false,
        message: "Unknown status from RunningHub",
        taskId: taskId,
        runninghubStatus: status,
        currentDbStatus: taskRecord.taskStatus
      });
    }

    // 更新数据库
    if (Object.keys(updateData).length > 0) {
      await prisma.backgroundRemovalTask.update({
        where: { replicateId: taskId },
        data: updateData
      });
      
      console.log(`💾 数据库已更新: ${taskId}`, updateData);
    }

    // 重新查询更新后的状态
    const updatedTaskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);

    return NextResponse.json({
      success: true,
      message: message,
      taskId: taskId,
      status: updatedTaskRecord?.taskStatus || taskRecord.taskStatus,
      output: updatedTaskRecord?.outputImageUrl || taskRecord.outputImageUrl,
      error: updatedTaskRecord?.errorMsg || taskRecord.errorMsg,
      runninghubStatus: status,
      updated: Object.keys(updateData).length > 0
    });

  } catch (error) {
    console.error(`❌ 同步任务失败: ${taskId}`, error);
    return NextResponse.json(
      { 
        success: false,
        error: "Sync failed", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

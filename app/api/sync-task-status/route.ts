import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { runninghubAPI } from "@/modules/runninghub";
import { findSora2VideoWatermarkRemovalTaskByRunningHubId, updateSora2VideoWatermarkRemovalTask } from "@/db/queries/sora2-video-watermark-removal";
import { findBackgroundRemovalTaskByReplicateId, updateBackgroundRemovalTask } from "@/db/queries/background-removal";
import { findWatermarkRemovalTaskByRunningHubId, updateWatermarkRemovalTask } from "@/db/queries/watermark-removal";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { taskId, taskType } = await req.json();
    
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    console.log(`🔄 手动同步任务状态: ${taskId}, 类型: ${taskType || 'auto'}`);

    let taskRecord: any = null;
    let updateFunction: any = null;
    let taskTypeDetected = taskType;

    // 自动检测任务类型
    if (!taskTypeDetected) {
      // 尝试查找背景移除任务
      taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
      if (taskRecord) {
        taskTypeDetected = 'background-removal';
        updateFunction = updateBackgroundRemovalTask;
      }
    }

    if (!taskRecord && !taskTypeDetected) {
      // 尝试查找 Sora2 视频去水印任务
      taskRecord = await findSora2VideoWatermarkRemovalTaskByRunningHubId(taskId);
      if (taskRecord) {
        taskTypeDetected = 'sora2-video-watermark-removal';
        updateFunction = updateSora2VideoWatermarkRemovalTask;
      }
    }

    if (!taskRecord && !taskTypeDetected) {
      // 尝试查找图片去水印任务
      taskRecord = await findWatermarkRemovalTaskByRunningHubId(taskId);
      if (taskRecord) {
        taskTypeDetected = 'watermark-removal';
        updateFunction = updateWatermarkRemovalTask;
      }
    }

    if (!taskRecord) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log(`✅ 找到任务记录: ${taskRecord.id}, 类型: ${taskTypeDetected}`);

    // 查询 RunningHub 任务状态
    const statusResp = await runninghubAPI.getTaskStatus(taskId);
    console.log(`📊 RunningHub状态响应:`, statusResp);

    let status: string | undefined;
    if (typeof (statusResp as any)?.data === 'string') {
      status = (statusResp as any).data as string;
    } else if ((statusResp as any)?.data && typeof (statusResp as any).data.status === 'string') {
      status = (statusResp as any).data.status as string;
    } else if ((statusResp as any)?.data && typeof (statusResp as any).data === 'object') {
      status = (statusResp as any).data.status || (statusResp as any).data;
    }

    console.log(`📊 解析的任务状态: ${status}`);

    if (!status) {
      return NextResponse.json({ error: "Unable to parse task status" }, { status: 400 });
    }

    let updateData: any = {};

    // 根据状态更新数据库
    switch (status) {
      case 'pending':
      case 'starting':
      case 'processing':
      case 'Processing':
      case 'queued':
      case 'Queued':
      case 'RUNNING':
      case 'running':
        console.log("⏳ 任务进行中:", status);
        updateData = {
          taskStatus: 'processing'
        };
        break;

      case 'succeeded':
      case 'SUCCESS':
        try {
          console.log(`🔍 任务成功，获取任务结果...`);
          const taskResult = await runninghubAPI.getTaskResult(taskId);
          
          // 检查是否是 APIKEY_TASK_IS_RUNNING 响应
          if (taskResult.code === 804 && taskResult.msg === 'APIKEY_TASK_IS_RUNNING') {
            console.log(`ℹ️ 任务状态为SUCCESS但结果API仍返回运行中`);
            updateData = {
              taskStatus: 'processing' // 保持处理中状态
            };
          } else if (taskResult.data && Array.isArray(taskResult.data) && taskResult.data.length > 0) {
            const outputFile = taskResult.data[0];
            const outputUrl = outputFile.fileUrl || null;
            
            // 根据任务类型使用不同的字段名
            if (taskTypeDetected === 'background-removal') {
              updateData = {
                taskStatus: 'succeeded',
                outputImageUrl: outputUrl,
                executeEndTime: BigInt(Date.now())
              };
            } else {
              updateData = {
                taskStatus: 'succeeded',
                imageUrl: outputUrl,
                executeEndTime: BigInt(Date.now())
              };
            }
            console.log(`✅ 任务成功完成，输出URL: ${outputUrl}`);
          } else {
            updateData = {
              taskStatus: 'succeeded',
              executeEndTime: BigInt(Date.now())
            };
            console.log(`✅ 任务成功完成，但无输出文件`);
          }
        } catch (resultError) {
          console.error("❌ 获取任务结果失败:", resultError);
          updateData = {
            taskStatus: 'succeeded',
            executeEndTime: BigInt(Date.now())
          };
        }
        break;

      case 'failed':
      case 'FAILED':
        console.log("❌ 任务失败");
        updateData = {
          taskStatus: 'failed',
          executeEndTime: BigInt(Date.now()),
          errorMsg: statusResp.msg || 'Task failed'
        };
        break;

      default:
        console.log("⚠️ 未知状态:", status);
        updateData = {
          taskStatus: status
        };
    }

    // 更新数据库
    if (Object.keys(updateData).length > 0) {
      console.log("📝 更新数据库:", updateData);
      
      // 根据任务类型使用不同的ID
      const updateId = taskTypeDetected === 'background-removal' 
        ? taskRecord.replicateId  // 背景移除任务使用replicateId
        : taskRecord.id;          // 其他任务使用记录ID
      
      await updateFunction(updateId, updateData);
      
      // 重新查询更新后的记录
      const updatedRecord = taskTypeDetected === 'sora2-video-watermark-removal' 
        ? await findSora2VideoWatermarkRemovalTaskByRunningHubId(taskId)
        : taskTypeDetected === 'background-removal'
        ? await findBackgroundRemovalTaskByReplicateId(taskId)
        : await findWatermarkRemovalTaskByRunningHubId(taskId);

      return NextResponse.json({
        success: true,
        taskId: taskId,
        taskType: taskTypeDetected,
        status: status,
        updateData: {
          ...updateData,
          executeStartTime: updateData.executeStartTime?.toString(),
          executeEndTime: updateData.executeEndTime?.toString()
        },
        updatedRecord: updatedRecord ? {
          ...updatedRecord,
          executeStartTime: updatedRecord.executeStartTime?.toString(),
          executeEndTime: updatedRecord.executeEndTime?.toString()
        } : null
      });
    }

    return NextResponse.json({
      success: true,
      taskId: taskId,
      taskType: taskTypeDetected,
      status: status,
      message: "No update needed"
    });

  } catch (error) {
    console.error("❌ 同步任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

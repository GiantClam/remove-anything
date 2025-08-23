import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { runninghubAPI } from "@/lib/runninghub-api";
import { findWatermarkRemovalTaskByRunningHubId, updateWatermarkRemovalTask } from "@/db/queries/watermark-removal";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const { searchParams } = new URL(req.url);
    const dbOnly = searchParams.get('dbOnly') === 'true';
    
    console.log("🔍 开始查询去水印任务状态");
    console.log("📋 请求参数:", { taskId, dbOnly, url: req.url });
    
    if (!taskId) {
      console.log("❌ 缺少taskId参数");
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    console.log("🔍 查询去水印任务状态:", taskId, dbOnly ? "(仅数据库)" : "(包含RunningHub)");

    // 首先从数据库查询任务记录
    const taskRecord = await findWatermarkRemovalTaskByRunningHubId(taskId);
    
    if (!taskRecord) {
      console.log("❌ 未找到去水印任务记录:", taskId);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log("✅ 找到去水印任务记录:", {
      id: taskRecord.id,
      userId: taskRecord.userId || "anonymous",
      status: taskRecord.taskStatus
    });

    // 如果只查询数据库状态，直接返回
    if (dbOnly) {
      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: taskId,
        taskStatus: taskRecord.taskStatus,
        inputZipUrl: taskRecord.inputZipUrl,
        outputZipUrl: taskRecord.outputZipUrl,
        errorMsg: taskRecord.errorMsg,
        createdAt: taskRecord.createdAt,
        executeStartTime: taskRecord.executeStartTime?.toString(),
        executeEndTime: taskRecord.executeEndTime?.toString()
      });
    }

    let finalStatus = taskRecord.taskStatus;

    // 如果任务还在进行中，从RunningHub获取最新状态
    if (['pending', 'starting', 'processing'].includes(taskRecord.taskStatus)) {
      try {
        console.log(`🔍 任务状态为 ${taskRecord.taskStatus}，从RunningHub获取最新状态...`);
        const runninghubStatus = await runninghubAPI.getTaskStatus(taskId);
        
        console.log(`📊 RunningHub状态: ${runninghubStatus.data?.status || runninghubStatus.data}, 数据库状态: ${taskRecord.taskStatus}`);
        
        // 同步数据库状态与RunningHub状态
        let updateData: any = {};
        
        switch (runninghubStatus.data?.status || runninghubStatus.data) {
          case 'starting':
          case 'STARTING':
            // 如果数据库状态是pending，更新为starting
            if (taskRecord.taskStatus === 'pending') {
              updateData = {
                taskStatus: 'starting',
                executeStartTime: BigInt(Date.now())
              };
            }
            break;
            
          case 'processing':
          case 'PROCESSING':
          case 'RUNNING':
            // 无论数据库状态是什么，都更新为processing
            updateData = {
              taskStatus: 'processing'
            };
            break;
            
          case 'succeeded':
          case 'SUCCESS':
            try {
              // 当任务成功时，获取任务结果
              console.log(`🔍 任务成功，获取任务结果...`);
              const taskResult = await runninghubAPI.getTaskResult(taskId);
              
              if (taskResult.data && Array.isArray(taskResult.data) && taskResult.data.length > 0) {
                const outputFile = taskResult.data[0];
                updateData = {
                  taskStatus: 'succeeded',
                  outputZipUrl: outputFile.fileUrl || null,
                  executeEndTime: BigInt(Date.now())
                };
                console.log(`✅ 任务成功完成，输出URL: ${outputFile.fileUrl}`);
              } else {
                updateData = {
                  taskStatus: 'succeeded',
                  executeEndTime: BigInt(Date.now())
                };
                console.log(`✅ 任务成功完成，但无输出文件`);
              }
            } catch (resultError) {
              console.error("❌ 获取任务结果失败:", resultError);
              // 即使获取结果失败，也标记任务为成功
              updateData = {
                taskStatus: 'succeeded',
                executeEndTime: BigInt(Date.now())
              };
            }
            break;
            
          case 'failed':
          case 'FAILED':
            updateData = {
              taskStatus: 'failed',
              executeEndTime: BigInt(Date.now()),
              errorMsg: runninghubStatus.data?.error || 'Task failed'
            };
            console.log(`❌ 任务失败: ${runninghubStatus.data?.error}`);
            break;
            
          case 'pending':
          case 'QUEUED':
            // 保持pending状态，不需要更新
            break;
            
          default:
            console.log(`ℹ️ 未知状态: ${runninghubStatus.data?.status || runninghubStatus.data}`);
            break;
        }
        
        // 如果有更新数据，更新数据库记录
        if (Object.keys(updateData).length > 0) {
          try {
            await updateWatermarkRemovalTask(taskRecord.id, updateData);
            console.log(`🔄 已更新 WatermarkRemovalTask 记录: ${taskRecord.id}，状态: ${updateData.taskStatus}`);
            finalStatus = updateData.taskStatus;
          } catch (dbError) {
            console.error("❌ 数据库更新失败:", {
              error: dbError.message,
              taskRecordId: taskRecord.id,
              updateData: updateData
            });
          }
        }
        
      } catch (statusError) {
        console.error("❌ 从RunningHub获取状态失败:", statusError);
        // 如果获取状态失败，继续使用数据库状态
        finalStatus = taskRecord.taskStatus;
      }
    }

    return NextResponse.json({
      success: true,
      id: taskRecord.id,
      runninghubTaskId: taskId,
      taskStatus: finalStatus,
      inputZipUrl: taskRecord.inputZipUrl,
      outputZipUrl: taskRecord.outputZipUrl,
      errorMsg: taskRecord.errorMsg,
      createdAt: taskRecord.createdAt,
      executeStartTime: taskRecord.executeStartTime?.toString(),
      executeEndTime: taskRecord.executeEndTime?.toString()
    });

  } catch (error) {
    console.error("❌ 查询去水印任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

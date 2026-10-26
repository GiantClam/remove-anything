import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { env } from "@/env.mjs";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { normalizeTaskStatus } from "@/lib/task-lifecycle";
import { runninghubAPI } from "@/modules/runninghub";
import { findSora2VideoWatermarkRemovalTaskByRunningHubId, updateSora2VideoWatermarkRemovalTask } from "@/db/queries/sora2-video-watermark-removal";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

function protectedVideoPreview(taskId: string, status: unknown, imageUrl: string | null | undefined) {
  return normalizeTaskStatus(status) === "succeeded" &&
    getR2ObjectKey(imageUrl, env.R2_URL_BASE)
    ? `/api/download?${new URLSearchParams({
        type: "sora2-video-watermark-removal",
        taskId,
        preview: "1",
      })}`
    : null;
}

function visibleVideoStatus(
  status: unknown,
  imageUrl: string | null | undefined,
) {
  const normalized = normalizeTaskStatus(status);
  return normalized === "succeeded" && !getR2ObjectKey(imageUrl, env.R2_URL_BASE)
    ? "processing"
    : normalized;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const { searchParams } = new URL(req.url);
    const dbOnly = searchParams.get('dbOnly') === 'true';
    
    console.log("🔍 开始查询Sora2视频去水印任务状态");
    console.log("📋 请求参数:", { taskId, dbOnly, url: req.url });
    
    if (!taskId) {
      console.log("❌ 缺少taskId参数");
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    console.log("🔍 查询Sora2视频去水印任务状态:", taskId, dbOnly ? "(仅数据库)" : "(包含RunningHub)");

    // 首先从数据库查询任务记录
    const taskRecord = await findSora2VideoWatermarkRemovalTaskByRunningHubId(taskId);
    
    if (!taskRecord) {
      console.log("❌ 未找到Sora2视频去水印任务记录:", taskId);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log("✅ 找到Sora2视频去水印任务记录:", {
      id: taskRecord.id,
      userId: taskRecord.userId || "anonymous",
      status: taskRecord.taskStatus
    });

    // 如果只查询数据库状态，直接返回
    if (dbOnly) {
      const visibleStatus = visibleVideoStatus(
        taskRecord.taskStatus,
        taskRecord.imageUrl,
      );
      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: taskId,
        taskStatus: visibleStatus,
        inputImageUrl: null,
        imageUrl: protectedVideoPreview(taskId, visibleStatus, taskRecord.imageUrl),
        errorMsg: taskRecord.errorMsg,
        createdAt: taskRecord.createdAt,
        executeStartTime: taskRecord.executeStartTime?.toString(),
        executeEndTime: taskRecord.executeEndTime?.toString()
      });
    }

    let finalStatus = taskRecord.taskStatus;
    let outputVideoUrl = taskRecord.imageUrl as string | null;
    let finalErrorMsg = taskRecord.errorMsg;

    // 如果任务还在进行中，从RunningHub获取最新状态
    console.log(`🔍 检查是否需要从RunningHub获取状态，当前数据库状态: ${taskRecord.taskStatus}`);
    if (['pending', 'starting', 'processing', 'Processing', 'queued', 'Queued', 'RUNNING', 'running'].includes(taskRecord.taskStatus)) {
      try {
        console.log(`🔍 任务状态为 ${taskRecord.taskStatus}，从RunningHub获取最新状态...`);
        const runninghubStatus = await runninghubAPI.getTaskStatus(taskId);
        
        console.log(`📊 RunningHub状态: ${runninghubStatus.data?.status || runninghubStatus.data}, 数据库状态: ${taskRecord.taskStatus}`);
        
        // 同步数据库状态与RunningHub状态
        let updateData: any = {};
        
        // 修复状态解析逻辑：RunningHub 返回的 data 可能是字符串或对象
        const currentStatus = typeof runninghubStatus.data === 'string' 
          ? runninghubStatus.data 
          : runninghubStatus.data?.status || 'unknown';
        console.log(`📊 RunningHub状态: ${currentStatus}, 数据库状态: ${taskRecord.taskStatus}`);
        
        switch (currentStatus) {
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
            // 对于 RUNNING 状态，尝试获取任务结果，因为任务可能已经完成
            if (currentStatus === 'RUNNING') {
                   try {
                     console.log(`🔍 RunningHub状态为RUNNING，尝试获取任务结果...`);
                     const taskResult = await runninghubAPI.getTaskResult(taskId);
                     
                     // 检查是否是 APIKEY_TASK_IS_RUNNING 响应
                     if (taskResult.code === 804 && taskResult.msg === 'APIKEY_TASK_IS_RUNNING') {
                       console.log(`ℹ️ 任务仍在运行中，保持processing状态`);
                       updateData = {
                         taskStatus: 'processing'
                       };
                     } else if (taskResult.data && Array.isArray(taskResult.data) && taskResult.data.length > 0) {
                       const outputFile = taskResult.data[0];
                outputVideoUrl =
                  typeof outputFile?.fileUrl === "string" &&
                  outputFile.fileUrl.trim()
                    ? outputFile.fileUrl.trim()
                    : null;
                updateData = outputVideoUrl
                  ? {
                      taskStatus: 'succeeded',
                      imageUrl: outputVideoUrl,
                      executeEndTime: BigInt(Date.now()),
                      errorMsg: null,
                    }
                  : {
                      taskStatus: 'processing',
                      executeEndTime: null,
                      errorMsg:
                        "The provider result is not available yet. Please retry shortly.",
                    };
                console.log(
                  outputVideoUrl
                    ? `✅ 任务实际已完成，输出URL: ${outputVideoUrl}`
                    : "ℹ️ 任务仍在处理中，无可用输出结果",
                );
                     } else {
                       // 没有结果，保持processing状态
                       updateData = {
                         taskStatus: 'processing'
                       };
                       console.log(`ℹ️ 任务仍在处理中，无输出结果`);
                     }
                   } catch (resultError) {
                     console.error("❌ 获取任务结果失败:", resultError);
              // A provider success without a durable output remains
              // recoverable; the secure download path must never expose a
              // terminal success with no stored result.
                     updateData = {
                       taskStatus: 'processing'
                , executeEndTime: null,
                errorMsg:
                  "The result could not be read yet. Please retry shortly.",
                     };
                   }
                 } else {
                   // 其他processing状态，直接更新
                   updateData = {
                     taskStatus: 'processing'
                   };
                 }
            break;
            
          case 'succeeded':
          case 'SUCCESS':
            try {
              // 当任务成功时，获取任务结果
              console.log(`🔍 任务成功，获取任务结果...`);
              const taskResult = await runninghubAPI.getTaskResult(taskId);
              
              // 检查是否是 APIKEY_TASK_IS_RUNNING 响应
              if (taskResult.code === 804 && taskResult.msg === 'APIKEY_TASK_IS_RUNNING') {
                console.log(`ℹ️ 任务状态为SUCCESS但结果API仍返回运行中，保持当前状态等待下次轮询`);
                // 不更新状态，保持当前状态，让下次轮询继续尝试
                updateData = {};
              } else if (taskResult.data && Array.isArray(taskResult.data) && taskResult.data.length > 0) {
                const outputFile = taskResult.data[0];
                outputVideoUrl =
                  typeof outputFile?.fileUrl === "string" &&
                  outputFile.fileUrl.trim()
                    ? outputFile.fileUrl.trim()
                    : null;
                updateData = outputVideoUrl
                  ? {
                      taskStatus: 'succeeded',
                      imageUrl: outputVideoUrl,
                      executeEndTime: BigInt(Date.now()),
                      errorMsg: null,
                    }
                  : {
                      taskStatus: 'processing',
                      executeEndTime: null,
                      errorMsg:
                        "The provider result is not available yet. Please retry shortly.",
                    };
                console.log(
                  outputVideoUrl
                    ? `✅ 任务成功完成，输出URL: ${outputVideoUrl}`
                    : "ℹ️ 供应商报告成功但尚无可用输出，保持处理中",
                );
              } else {
                updateData = {
                  taskStatus: 'processing',
                  executeEndTime: null,
                  errorMsg:
                    "The provider result is not available yet. Please retry shortly.",
                };
                console.log("ℹ️ 供应商报告成功但无输出文件，保持处理中");
              }
            } catch (resultError) {
              console.error("❌ 获取任务结果失败:", resultError);
              // A provider success without durable output remains recoverable.
              updateData = {
                taskStatus: 'processing',
                executeEndTime: null,
                errorMsg:
                  "The result could not be read yet. Please retry shortly.",
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

          case 'expired':
          case 'EXPIRED':
          case 'timeout':
          case 'TIMEOUT':
          case 'timed_out':
          case 'TIMED_OUT':
            updateData = {
              taskStatus: 'expired',
              executeEndTime: BigInt(Date.now()),
              errorMsg: runninghubStatus.data?.error || 'Task expired',
            };
            console.log(`⌛ 任务已过期`);
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
            await updateSora2VideoWatermarkRemovalTask(taskRecord.id, updateData);
            console.log(`🔄 已更新 Sora2视频去水印任务记录: ${taskRecord.id}，状态: ${updateData.taskStatus}`);
            finalStatus = updateData.taskStatus;
            finalErrorMsg = updateData.errorMsg ?? finalErrorMsg;
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
      taskStatus: visibleVideoStatus(finalStatus, outputVideoUrl || taskRecord.imageUrl),
      inputImageUrl: null,
      imageUrl: protectedVideoPreview(
        taskId,
        finalStatus,
        outputVideoUrl || taskRecord.imageUrl,
      ),
      errorMsg: finalErrorMsg,
      createdAt: taskRecord.createdAt,
      executeStartTime: taskRecord.executeStartTime?.toString(),
      executeEndTime: taskRecord.executeEndTime?.toString()
    });

  } catch (error) {
    console.error("❌ 查询Sora2视频去水印任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}



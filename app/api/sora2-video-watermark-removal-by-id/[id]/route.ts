import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { runninghubAPI } from "@/modules/runninghub";
import { findSora2VideoWatermarkRemovalTaskById, updateSora2VideoWatermarkRemovalTask } from "@/db/queries/sora2-video-watermark-removal";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recordId = params.id;
    const { searchParams } = new URL(req.url);
    const dbOnly = searchParams.get('dbOnly') === 'true';
    
    console.log("🔍 开始查询Sora2视频去水印任务状态 (通过记录ID)");
    console.log("📋 请求参数:", { recordId, dbOnly, url: req.url });
    
    if (!recordId) {
      console.log("❌ 缺少recordId参数");
      return NextResponse.json({ error: "Record ID is required" }, { status: 400 });
    }

    console.log("🔍 查询Sora2视频去水印任务状态:", recordId, dbOnly ? "(仅数据库)" : "(包含RunningHub)");

    // 首先从数据库查询任务记录
    const taskRecord = await findSora2VideoWatermarkRemovalTaskById(parseInt(recordId));
    
    if (!taskRecord) {
      console.log("❌ 未找到Sora2视频去水印任务记录:", recordId);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log("✅ 找到Sora2视频去水印任务记录:", {
      id: taskRecord.id,
      userId: taskRecord.userId || "anonymous",
      status: taskRecord.taskStatus,
      replicateId: taskRecord.replicateId
    });

    // 如果只查询数据库状态，直接返回
    if (dbOnly) {
      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: taskRecord.replicateId,
        taskStatus: taskRecord.taskStatus,
        inputImageUrl: taskRecord.inputImageUrl,
        imageUrl: taskRecord.imageUrl,
        executeStartTime: taskRecord.executeStartTime ? Number(taskRecord.executeStartTime) : null,
        executeEndTime: taskRecord.executeEndTime ? Number(taskRecord.executeEndTime) : null,
        errorMsg: taskRecord.errorMsg,
        user: taskRecord.user
      });
    }

    // 如果没有 RunningHub 任务 ID，返回数据库状态
    if (!taskRecord.replicateId) {
      console.log("⚠️ 没有 RunningHub 任务 ID，返回数据库状态");
      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: null,
        taskStatus: taskRecord.taskStatus,
        inputImageUrl: taskRecord.inputImageUrl,
        imageUrl: taskRecord.imageUrl,
        executeStartTime: taskRecord.executeStartTime ? Number(taskRecord.executeStartTime) : null,
        executeEndTime: taskRecord.executeEndTime ? Number(taskRecord.executeEndTime) : null,
        errorMsg: taskRecord.errorMsg,
        user: taskRecord.user
      });
    }

    // 查询 RunningHub 任务状态
    console.log("🔍 查询 RunningHub 任务状态:", taskRecord.replicateId);
    
    try {
      const taskStatus = await runninghubAPI.getTaskStatus(taskRecord.replicateId);
      console.log("📊 RunningHub 任务状态:", taskStatus);

      if (taskStatus.code === 0 && taskStatus.data) {
        const status = taskStatus.data.status;
        console.log("📊 任务状态:", status);

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
              taskStatus: 'processing',
              replicateStatus: status
            };
            break;

          case 'succeeded':
          case 'SUCCESS':
            try {
              // 当任务成功时，获取任务结果
              console.log(`🔍 任务成功，获取任务结果...`);
              const taskResult = await runninghubAPI.getTaskResult(taskRecord.replicateId);
              
              // 检查是否是 APIKEY_TASK_IS_RUNNING 响应
              if (taskResult.code === 804 && taskResult.msg === 'APIKEY_TASK_IS_RUNNING') {
                console.log(`ℹ️ 任务状态为SUCCESS但结果API仍返回运行中，保持当前状态等待下次轮询`);
                // 不更新状态，保持当前状态，让下次轮询继续尝试
                updateData = {};
              } else if (taskResult.data && Array.isArray(taskResult.data) && taskResult.data.length > 0) {
                const outputFile = taskResult.data[0];
                const outputVideoUrl = outputFile.fileUrl || null;
                updateData = {
                  taskStatus: 'succeeded',
                  imageUrl: outputVideoUrl,
                  executeEndTime: BigInt(Date.now()),
                  replicateStatus: 'succeeded'
                };
                console.log(`✅ 任务成功完成，输出URL: ${outputFile.fileUrl}`);
              } else {
                updateData = {
                  taskStatus: 'succeeded',
                  executeEndTime: BigInt(Date.now()),
                  replicateStatus: 'succeeded'
                };
                console.log(`✅ 任务成功完成，但无输出文件`);
              }
            } catch (resultError) {
              console.error("❌ 获取任务结果失败:", resultError);
              // 即使获取结果失败，也标记任务为成功
              updateData = {
                taskStatus: 'succeeded',
                executeEndTime: BigInt(Date.now()),
                replicateStatus: 'succeeded'
              };
            }
            break;

          case 'failed':
          case 'FAILED':
            console.log("❌ 任务失败");
            updateData = {
              taskStatus: 'failed',
              executeEndTime: BigInt(Date.now()),
              errorMsg: taskStatus.msg || 'Task failed',
              replicateStatus: 'failed'
            };
            break;

          default:
            console.log("⚠️ 未知状态:", status);
            updateData = {
              replicateStatus: status
            };
        }

        // 更新数据库
        if (Object.keys(updateData).length > 0) {
          console.log("📝 更新数据库:", updateData);
          await updateSora2VideoWatermarkRemovalTask(taskRecord.id, updateData);
          
          // 重新查询更新后的记录
          const updatedRecord = await findSora2VideoWatermarkRemovalTaskById(taskRecord.id);
          if (updatedRecord) {
            taskRecord.taskStatus = updatedRecord.taskStatus;
            taskRecord.imageUrl = updatedRecord.imageUrl;
            taskRecord.executeEndTime = updatedRecord.executeEndTime;
            taskRecord.errorMsg = updatedRecord.errorMsg;
          }
        }

        return NextResponse.json({
          success: true,
          id: taskRecord.id,
          runninghubTaskId: taskRecord.replicateId,
          taskStatus: taskRecord.taskStatus,
          inputImageUrl: taskRecord.inputImageUrl,
          imageUrl: taskRecord.imageUrl,
          executeStartTime: taskRecord.executeStartTime ? Number(taskRecord.executeStartTime) : null,
          executeEndTime: taskRecord.executeEndTime ? Number(taskRecord.executeEndTime) : null,
          errorMsg: taskRecord.errorMsg,
          user: taskRecord.user,
          runninghubStatus: status
        });

      } else {
        console.log("⚠️ RunningHub API 返回错误:", taskStatus);
        return NextResponse.json({
          success: true,
          id: taskRecord.id,
          runninghubTaskId: taskRecord.replicateId,
          taskStatus: taskRecord.taskStatus,
          inputImageUrl: taskRecord.inputImageUrl,
          imageUrl: taskRecord.imageUrl,
          executeStartTime: taskRecord.executeStartTime ? Number(taskRecord.executeStartTime) : null,
          executeEndTime: taskRecord.executeEndTime ? Number(taskRecord.executeEndTime) : null,
          errorMsg: taskRecord.errorMsg,
          user: taskRecord.user,
          runninghubError: taskStatus.msg
        });
      }

    } catch (apiError) {
      console.error("❌ 查询 RunningHub 任务状态失败:", apiError);
      
      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: taskRecord.replicateId,
        taskStatus: taskRecord.taskStatus,
        inputImageUrl: taskRecord.inputImageUrl,
        imageUrl: taskRecord.imageUrl,
        executeStartTime: taskRecord.executeStartTime ? Number(taskRecord.executeStartTime) : null,
        executeEndTime: taskRecord.executeEndTime ? Number(taskRecord.executeEndTime) : null,
        errorMsg: taskRecord.errorMsg,
        user: taskRecord.user,
        apiError: getErrorMessage(apiError)
      });
    }

  } catch (error) {
    console.error("❌ 查询Sora2视频去水印任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

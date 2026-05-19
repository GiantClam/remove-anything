import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { findWatermarkRemovalTaskByRunningHubId, updateWatermarkRemovalTask } from "@/db/queries/watermark-removal";
import { findSora2VideoWatermarkRemovalTaskByRunningHubId, updateSora2VideoWatermarkRemovalTask } from "@/db/queries/sora2-video-watermark-removal";
import { nanoid } from "nanoid";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import { taskQueueManager } from "@/lib/task-queue";
import { createR2S3Service } from "@/lib/r2-s3";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

// 下载ZIP文件并保存到R2
async function downloadAndSaveToR2(zipUrl: string, taskId: string): Promise<string> {
  try {
    console.log(`📥 开始下载并保存ZIP文件到R2: ${zipUrl}`);
    
    // 下载ZIP文件
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ZIP: ${response.status}`);
    }
    
    const contentTypeHeader = response.headers.get('content-type') || '';
    const downloadedArrayBuffer = await response.arrayBuffer();

    // 判断是否已是有效 ZIP（魔数 PK\x03\x04 或 PK\x05\x06 等）
    const uint8 = new Uint8Array(downloadedArrayBuffer);
    const isZipMagic = uint8.length >= 2 && uint8[0] === 0x50 && uint8[1] === 0x4b;

    let finalZipBuffer: Buffer;
    if (contentTypeHeader.includes('zip') && isZipMagic) {
      // 已经是合法 ZIP，直接上传
      finalZipBuffer = Buffer.from(downloadedArrayBuffer);
    } else {
      // 不是 ZIP：将单文件打包为 ZIP
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      // 猜测扩展名
      const fromContentType = contentTypeHeader.split('/')[1] || '';
      const guessedExt = fromContentType ? fromContentType.split(';')[0] : '';
      const urlExtMatch = zipUrl.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
      const urlExt = urlExtMatch?.[1];
      const ext = (guessedExt || urlExt || 'png').toLowerCase();
      zip.file(`image_1.${ext}`, downloadedArrayBuffer);
      const zippedArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      finalZipBuffer = Buffer.from(zippedArrayBuffer);
      console.log(`🧩 已将非ZIP内容重新打包为ZIP，内含扩展名为 .${ext} 的文件`);
    }
    
    const s3 = createR2S3Service();
    
    // 生成文件名
    const storedFilename = `${taskId}-${nanoid(8)}.zip`;
    const fileName = `watermark-removal/processed/${storedFilename}`;

    await s3.putItemInBucket(storedFilename, finalZipBuffer, {
      path: "watermark-removal/processed",
      ContentType: "application/zip",
      acl: "public-read",
    });
    
    // 构建公共访问URL
    const r2PublicUrl = `${env.R2_URL_BASE}/${fileName}`;
    
    console.log(`✅ ZIP文件已保存到R2: ${r2PublicUrl}`);
    return r2PublicUrl;
    
  } catch (error) {
    console.error(`❌ 保存ZIP文件到R2失败:`, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("📨 收到RunningHub webhook:", body);

    const { event, taskId, eventData } = body;
    
    // 根据RunningHub API文档，webhook格式为：
    // { "event": "TASK_END", "taskId": "...", "eventData": "..." }
    if (event !== "TASK_END") {
      console.log(`ℹ️ 忽略非TASK_END事件: ${event}`);
      return NextResponse.json({ message: "Ignored non-TASK_END event" }, { status: 200 });
    }
    
    if (!taskId) {
      console.log("❌ webhook缺少taskId");
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    // 解析eventData
    let parsedEventData;
    try {
      parsedEventData = JSON.parse(eventData);
      console.log("📦 解析的eventData:", parsedEventData);
    } catch (parseError) {
      console.error("❌ 解析eventData失败:", parseError);
      return NextResponse.json({ error: "Invalid eventData format" }, { status: 400 });
    }

    const { code, msg, data } = parsedEventData;
    
    // 检查API返回状态
    if (code !== 0) {
      console.log(`❌ RunningHub API返回错误: ${msg}`);
      // 即使API返回错误，我们也需要更新任务状态
    }

    // 查找对应的任务记录（先查找图片去水印，再查找Sora2视频去水印）
    let watermarkTaskRecord = await findWatermarkRemovalTaskByRunningHubId(taskId);
    let sora2TaskRecord: any = null;
    let taskType = 'watermark-removal';
    let taskRecord: any = null;
    
    if (watermarkTaskRecord) {
      taskRecord = watermarkTaskRecord;
      taskType = 'watermark-removal';
    } else {
      sora2TaskRecord = await findSora2VideoWatermarkRemovalTaskByRunningHubId(taskId);
      if (sora2TaskRecord) {
        taskRecord = sora2TaskRecord;
        taskType = 'sora2-video-watermark-removal';
      }
    }
    
    if (!taskRecord) {
      console.log(`❌ 未找到任务记录: ${taskId}`);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    
    console.log(`🔍 找到任务记录: ${taskId}，类型: ${taskType}`);

    console.log(`🔄 处理任务状态更新: ${taskId} -> code: ${code}, msg: ${msg}`);

    let updateData: any = {};
    
    // 根据RunningHub API的返回格式处理
    if (code === 0) {
      // 任务成功
      if (data && Array.isArray(data) && data.length > 0) {
        try {
          const outputFile = data[0];
          
          if (taskType === 'watermark-removal') {
            // 图片去水印：下载ZIP文件并保存到R2
            const r2ZipUrl = await downloadAndSaveToR2(outputFile.fileUrl, taskRecord.id.toString());
            updateData = {
              taskStatus: "succeeded",
              outputZipUrl: r2ZipUrl,
              executeEndTime: BigInt(Date.now())
            };
            console.log(`✅ 图片去水印任务成功完成: ${taskId}，输出URL: ${r2ZipUrl}`);
          } else if (taskType === 'sora2-video-watermark-removal') {
            // Sora2视频去水印：直接保存视频URL
            updateData = {
              taskStatus: "succeeded",
              imageUrl: outputFile.fileUrl, // 使用imageUrl字段存储视频URL
              executeEndTime: BigInt(Date.now())
            };
            console.log(`✅ Sora2视频去水印任务成功完成: ${taskId}，视频URL: ${outputFile.fileUrl}`);
          }
        } catch (downloadError) {
          console.error("❌ 处理输出文件失败:", downloadError);
          // 即使处理失败，也记录任务成功
          updateData = {
            taskStatus: "succeeded",
            executeEndTime: BigInt(Date.now())
          };
        }
      } else {
        updateData = {
          taskStatus: "succeeded",
          executeEndTime: BigInt(Date.now())
        };
        console.log(`✅ 任务成功完成: ${taskId}，但无输出文件`);
      }
    } else {
      // 任务失败
      updateData = {
        taskStatus: "failed",
        executeEndTime: BigInt(Date.now()),
        errorMsg: msg || "Task failed",
      };
      console.log(`❌ 任务失败: ${taskId}，错误: ${msg}`);
    }
    
    // 更新数据库记录
    try {
      if (taskType === 'watermark-removal') {
        await updateWatermarkRemovalTask(taskRecord.id, updateData);
        console.log(`🔄 已更新 WatermarkRemovalTask 记录: ${taskRecord.id}，状态: ${updateData.taskStatus}`);
      } else if (taskType === 'sora2-video-watermark-removal') {
        await updateSora2VideoWatermarkRemovalTask(taskRecord.id, updateData);
        console.log(`🔄 已更新 Sora2VideoWatermarkRemovalTask 记录: ${taskRecord.id}，状态: ${updateData.taskStatus}`);
      }
    } catch (dbError) {
      console.error("❌ 数据库更新失败:", {
        error: dbError.message,
        taskRecordId: taskRecord.id,
        taskType: taskType,
        updateData: updateData
      });
      return NextResponse.json(
        { error: "Database update failed", details: dbError.message },
        { status: 500 }
      );
    }
    
    console.log(`✅ RunningHub webhook 处理完成: ${taskId}，状态: ${status}`);

    // 进入终态后停止 watcher
    try {
      const finalStatus = updateData.taskStatus;
      if (finalStatus === 'succeeded' || finalStatus === 'failed') {
        taskQueueManager.stopStatusWatcher(taskId);
      }
    } catch {}
    
    return NextResponse.json({ 
      message: "Webhook processed successfully",
      taskId: taskId,
      taskRecordId: taskRecord.id,
      status: updateData.taskStatus
    }, { status: 200 });
    
  } catch (error) {
    console.error("❌ RunningHub webhook 详细错误:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      constructor: error.constructor.name
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

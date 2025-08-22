import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { findWatermarkRemovalTaskByRunningHubId, updateWatermarkRemovalTask } from "@/db/queries/watermark-removal";
import AWS from 'aws-sdk';
import { nanoid } from "nanoid";
import { env } from "@/env.mjs";

// 下载ZIP文件并保存到R2
async function downloadAndSaveToR2(zipUrl: string, taskId: string): Promise<string> {
  try {
    console.log(`📥 开始下载并保存ZIP文件到R2: ${zipUrl}`);
    
    // 下载ZIP文件
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ZIP: ${response.status}`);
    }
    
    const zipBuffer = await response.arrayBuffer();
    
    // 配置AWS S3（用于R2）
    const s3 = new AWS.S3({
      endpoint: env.R2_ENDPOINT,
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
      region: env.R2_REGION || 'auto',
      s3ForcePathStyle: true,
    });
    
    // 生成文件名
    const fileName = `watermark-removal/processed/${taskId}-${nanoid(8)}.zip`;
    
    // 上传到R2
    const uploadResult = await s3.upload({
      Bucket: env.R2_BUCKET,
      Key: fileName,
      Body: Buffer.from(zipBuffer),
      ContentType: 'application/zip',
    }).promise();
    
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

    // 查找对应的任务记录
    const taskRecord = await findWatermarkRemovalTaskByRunningHubId(taskId);
    if (!taskRecord) {
      console.log(`❌ 未找到任务记录: ${taskId}`);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log(`🔄 处理任务状态更新: ${taskId} -> code: ${code}, msg: ${msg}`);

    let updateData: any = {};
    
    // 根据RunningHub API的返回格式处理
    if (code === 0) {
      // 任务成功
      if (data && Array.isArray(data) && data.length > 0) {
        try {
          // 下载输出ZIP文件并保存到R2
          const outputFile = data[0];
          const r2ZipUrl = await downloadAndSaveToR2(outputFile.fileUrl, taskRecord.id.toString());
          
          updateData = {
            taskStatus: "succeeded",
            outputZipUrl: r2ZipUrl,
            executeEndTime: BigInt(Date.now())
          };
          console.log(`✅ 任务成功完成: ${taskId}，输出URL: ${r2ZipUrl}`);
        } catch (downloadError) {
          console.error("❌ 下载输出文件失败:", downloadError);
          // 即使下载失败，也记录任务成功，但outputZipUrl为空
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
      await updateWatermarkRemovalTask(taskRecord.id, updateData);
      console.log(`🔄 已更新 WatermarkRemovalTask 记录: ${taskRecord.id}，状态: ${updateData.taskStatus}`);
    } catch (dbError) {
      console.error("❌ 数据库更新失败:", {
        error: dbError.message,
        taskRecordId: taskRecord.id,
        updateData: updateData
      });
      return NextResponse.json(
        { error: "Database update failed", details: dbError.message },
        { status: 500 }
      );
    }
    
    console.log(`✅ RunningHub webhook 处理完成: ${taskId}，状态: ${status}`);
    
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

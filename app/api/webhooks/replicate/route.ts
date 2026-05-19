import { NextResponse, type NextRequest } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { env } from "@/env.mjs";
import { findBackgroundRemovalTaskByReplicateId, updateBackgroundRemovalTask } from "@/db/queries/background-removal";
import { nanoid } from "nanoid";
import { createR2S3Service } from "@/lib/r2-s3";

// 下载图片并保存到R2
async function downloadAndSaveToR2(imageUrl: string, taskId: string): Promise<string> {
  try {
    console.log(`📥 开始下载并保存图片到R2: ${imageUrl}`);
    
    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    
    const s3 = createR2S3Service();
    
    // 生成文件名
    const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
    const storedFilename = `${taskId}-${nanoid(8)}.${fileExtension}`;
    const fileName = `background-removal/processed/${storedFilename}`;

    await s3.putItemInBucket(storedFilename, Buffer.from(imageBuffer), {
      path: "background-removal/processed",
      ContentType: contentType,
      acl: "public-read",
    });
    
    // 构建公共访问URL
    const r2PublicUrl = `${env.R2_URL_BASE}/${fileName}`;
    
    console.log(`✅ 图片已保存到R2: ${r2PublicUrl}`);
    return r2PublicUrl;
    
  } catch (error) {
    console.error(`❌ 保存图片到R2失败:`, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 Replicate Webhook 开始处理");
    console.log("🔍 环境检查:", {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      timestamp: new Date().toISOString()
    });

    const body = await req.json();
    console.log("📨 Webhook 数据:", {
      id: body.id,
      status: body.status,
      hasOutput: !!body.output,
      hasError: !!body.error
    });
    
    // 验证 webhook 签名（生产环境应该验证）
    const signature = req.headers.get('replicate-signature');
    if (env.REPLICATE_WEBHOOK_SECRET && signature) {
      // TODO: 在生产环境中验证 webhook 签名
      // const isValid = verifyWebhookSignature(body, signature, env.REPLICATE_WEBHOOK_SECRET);
      // if (!isValid) {
      //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      // }
    }
    
    console.log("📨 收到 Replicate webhook:", {
      id: body.id,
      status: body.status,
      output: body.output ? "有输出" : "无输出",
      outputType: body.output ? typeof body.output : "undefined",
      logs: body.logs ? "有日志" : "无日志",
      logsType: body.logs ? typeof body.logs : "undefined",
      logsIsArray: body.logs ? Array.isArray(body.logs) : "undefined",
      error: body.error ? "有错误" : "无错误",
      errorType: body.error ? typeof body.error : "undefined"
    });
    
    // 查找对应的 BackgroundRemovalTask 记录
    console.log(`🔍 查找 BackgroundRemovalTask 记录，replicateId: ${body.id}`);
    let taskRecord;
    try {
      taskRecord = await findBackgroundRemovalTaskByReplicateId(body.id);
    } catch (dbError) {
      console.error("❌ 数据库查询失败:", {
        error: dbError.message,
        replicateId: body.id
      });
      // 即使数据库查询失败，也返回 200 避免 webhook 重试
      return NextResponse.json({ 
        message: "Database query failed, but webhook received",
        error: dbError.message
      }, { status: 200 });
    }
    
    if (!taskRecord) {
      console.warn(`⚠️ 未找到对应的 BackgroundRemovalTask 记录，replicateId: ${body.id}`);
      // 返回 200 而不是 404，避免 webhook 重试
      return NextResponse.json({ 
        message: "Task not found, but webhook received" 
      }, { status: 200 });
    }
    
    console.log("✅ 找到任务记录:", {
      id: taskRecord.id,
      userId: taskRecord.userId || "anonymous",
      status: taskRecord.taskStatus
    });
    
    // 根据 Replicate 状态更新数据库
    let updateData: any = {};
    
    switch (body.status) {
      case "pending":
        updateData = {
          taskStatus: "pending",
        };
        console.log(`⏳ 任务等待中: ${body.id}`);
        break;
        
      case "starting":
        updateData = {
          taskStatus: "starting",
          executeStartTime: BigInt(Date.now()),
        };
        console.log(`🚀 任务开始处理: ${body.id}`);
        break;
        
      case "processing":
        updateData = {
          taskStatus: "processing",
        };
        console.log(`⚙️ 任务处理中: ${body.id}`);
        break;
        
      case "succeeded":
        const replicateImageUrl = Array.isArray(body.output) ? body.output[0] : body.output;
        
        // 安全处理 logs 字段
        let logsText = "";
        if (body.logs) {
          if (Array.isArray(body.logs)) {
            logsText = body.logs.join("\n");
          } else if (typeof body.logs === "string") {
            logsText = body.logs;
          } else {
            logsText = JSON.stringify(body.logs);
          }
        }
        
        // 下载Replicate的结果图片并保存到R2
        let r2ImageUrl = replicateImageUrl; // 默认使用Replicate URL作为备用
        try {
          r2ImageUrl = await downloadAndSaveToR2(replicateImageUrl, body.id);
          console.log(`✅ 图片已保存到R2: ${r2ImageUrl}`);
        } catch (r2Error) {
          console.error(`❌ 保存到R2失败，使用原始URL:`, r2Error);
          // 继续使用Replicate的URL，不阻断流程
        }
        
        updateData = {
          taskStatus: "succeeded",
          outputImageUrl: r2ImageUrl,
          executeEndTime: BigInt(Date.now()),
          errorMsg: logsText,
        };
        console.log(`✅ 任务成功完成: ${body.id}，最终图片URL: ${r2ImageUrl}`);
        break;
        
      case "failed":
      case "canceled":
        // 安全处理错误信息
        let errorMsg = "Task failed";
        if (body.error) {
          if (typeof body.error === "string") {
            errorMsg = body.error;
          } else if (body.error.message) {
            errorMsg = body.error.message;
          } else {
            errorMsg = JSON.stringify(body.error);
          }
        }
        
        updateData = {
          taskStatus: "failed",
          executeEndTime: BigInt(Date.now()),
          errorMsg: errorMsg,
        };
        console.log(`❌ 任务失败: ${body.id}，错误: ${errorMsg}`);
        break;
        
      default:
        console.log(`ℹ️ 未知状态: ${body.status} for ${body.id}`);
        return NextResponse.json({ 
          message: "Unknown status" 
        }, { status: 200 });
    }
    
    // 更新数据库记录
    try {
      await updateBackgroundRemovalTask(body.id, updateData);
      console.log(`🔄 已更新 BackgroundRemovalTask 记录: ${taskRecord.id}，状态: ${updateData.taskStatus}`);
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
    
    console.log(`✅ Webhook 处理完成: ${body.id}，状态: ${body.status}`);
    
    return NextResponse.json({ 
      message: "Webhook processed successfully",
      taskId: body.id,
      taskRecordId: taskRecord.id,
      status: updateData.taskStatus
    }, { status: 200 });
    
  } catch (error) {
    console.error("❌ Webhook 详细错误:", {
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

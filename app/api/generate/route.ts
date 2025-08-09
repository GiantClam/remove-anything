import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { nanoid } from "nanoid";

import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";
import { env } from "@/env.mjs";
import AWS from 'aws-sdk';
import crypto from 'crypto';
import { createBackgroundRemovalTask } from "@/db/queries/background-removal";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "10s"
});

function getKey(id: string) {
  return `generate:${id}`;
}

export const maxDuration = 60;

// 简化的文件上传到R2的函数
async function uploadToR2(file: File): Promise<string> {
  try {
    console.log("📤 开始上传文件到R2...");
    
    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `${nanoid(12)}.${fileExtension}`;
    const key = `background-removal/${filename}`;
    
    // 转换文件为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 配置AWS S3客户端用于Cloudflare R2
    const s3Client = new AWS.S3({
      endpoint: env.R2_ENDPOINT,
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
      signatureVersion: 'v4',
      region: 'auto', // Cloudflare R2使用auto作为区域
      s3ForcePathStyle: true, // 强制使用路径样式
    });
    
    console.log("文件大小:", buffer.length, "bytes");
    console.log("文件类型:", file.type);
    console.log("上传键:", key);
    console.log("R2端点:", env.R2_ENDPOINT);
    console.log("R2存储桶:", env.R2_BUCKET);
    
    // 上传文件到R2
    const uploadParams = {
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read'
    };
    
    const result = await s3Client.upload(uploadParams).promise();
    
    // 构建公共访问URL
    const publicUrl = `${env.R2_URL_BASE}/${key}`;
    console.log("✅ 文件上传成功:", publicUrl);
    console.log("S3结果:", result);
    
    return publicUrl;
  } catch (error) {
    console.error("❌ 文件上传失败:", error);
    
    // 如果是认证错误，提供更详细的调试信息
    if (error.code === 'SignatureDoesNotMatch') {
      console.error("🔍 R2认证调试信息:");
      console.error("- R2_ENDPOINT:", env.R2_ENDPOINT);
      console.error("- R2_BUCKET:", env.R2_BUCKET);
      console.error("- R2_ACCESS_KEY长度:", env.R2_ACCESS_KEY?.length);
      console.error("- R2_SECRET_KEY长度:", env.R2_SECRET_KEY?.length);
      console.error("- R2_URL_BASE:", env.R2_URL_BASE);
    }
    
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const userId = user?.id || null; // 对于匿名用户，使用null而不是"anonymous"

  const { success } = await ratelimit.limit(
    getKey(userId || "anonymous") + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    // 检查Content-Type，支持FormData和JSON两种格式
    const contentType = req.headers.get('content-type') || '';
    
    let imageUrl: string;
    
    if (contentType.includes('multipart/form-data')) {
      // 处理FormData格式
      const formData = await req.formData();
      const image = formData.get('image') as File;
      
      if (!image) {
        return NextResponse.json({ error: "No image provided" }, { status: 400 });
      }

      // 上传文件到R2
      try {
        imageUrl = await uploadToR2(image);
      } catch (uploadError) {
        console.error("❌ 文件上传失败:", uploadError);
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
      }
    } else {
      // 处理JSON格式
      const data = await req.json();
      imageUrl = data.image || data.inputImageUrl;
      
      if (!imageUrl) {
        return NextResponse.json({ error: "No image URL provided" }, { status: 400 });
      }
    }

    console.log("🚀 开始调用 Cloudflare AI Gateway + Replicate 进行背景移除...");
    console.log("图片URL:", imageUrl);
    console.log("用户ID:", userId || "anonymous");

    // 使用异步调用
    const result = await aiGateway.removeBackgroundAsync({
      image: imageUrl,
      resolution: "1024x1024", // 使用默认分辨率
    });

    // 创建任务记录
    const taskRecord = await createBackgroundRemovalTask({
      userId: userId || undefined, // 对于匿名用户，传递undefined
      replicateId: result.id,
      inputImageUrl: imageUrl,
      resolution: "1024x1024",
      model: "men1scus/birefnet"
    });
    
    console.log("✅ 异步任务创建成功:", result);
    console.log("✅ 任务记录创建成功:", taskRecord);

    // 返回任务信息
    return NextResponse.json({
      success: true,
      taskId: result.id,
      status: result.status,
      message: "Background removal task created successfully",
      urls: result.urls,
      taskRecordId: taskRecord?.id
    });

  } catch (error) {
    console.error("❌ 处理失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

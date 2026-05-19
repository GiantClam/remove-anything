import { nanoid } from "nanoid";
import { env } from "@/env.mjs";
import { createR2S3Service } from "@/lib/r2-s3";

/**
 * 上传文件到 Cloudflare R2 存储
 * 支持大文件上传，绕过 Vercel 限制
 */
export async function uploadToR2(file: File): Promise<string> {
  let uploadKey = "";
  try {
    console.log("📤 开始上传文件到 R2...");
    console.log("文件信息:", {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop() || 'mp4';
    const filename = `${nanoid(12)}.${fileExtension}`;
    const key = `uploads/${filename}`;
    uploadKey = key;
    
    // 转换文件为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const s3Client = createR2S3Service();
    
    console.log("R2 配置信息:", { key, bufferSize: buffer.length });
    const result = await s3Client.putItemInBucket(filename, buffer, {
      path: "uploads",
      ContentType: file.type,
      acl: "public-read",
    });
    
    const publicUrl = result.completedUrl;
    console.log("✅ 文件上传成功:", publicUrl);
    console.log("S3 上传结果:", result);
    
    return publicUrl;
  } catch (error: any) {
    console.error("❌ 文件上传失败:", error);
    
    // 如果是认证错误，提供更详细的调试信息
    if (error?.code === 'SignatureDoesNotMatch') {
      console.error("🔍 R2 认证调试信息:");
      console.error("- R2_ACCESS_KEY 长度:", env.R2_ACCESS_KEY?.length);
      console.error("- R2_SECRET_KEY 长度:", env.R2_SECRET_KEY?.length);
      console.error("- 上传目标键:", uploadKey);
    }
    
    throw error;
  }
}

/**
 * 从 R2 URL 下载文件
 */
export async function downloadFromR2(r2Url: string): Promise<Buffer> {
  try {
    console.log("📥 从 R2 下载文件:", r2Url);
    
    const response = await fetch(r2Url);
    if (!response.ok) {
      throw new Error(`Failed to download file from R2: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log("✅ 从 R2 下载完成，文件大小:", buffer.length, "bytes");
    return buffer;
  } catch (error) {
    console.error("❌ 从 R2 下载失败:", error);
    throw error;
  }
}

/**
 * 生成 R2 预签名下载 URL（用于访问文件）
 */
export async function generateR2PresignedDownloadUrl(key: string): Promise<string> {
  try {
    console.log("🔗 生成 R2 预签名下载 URL...");
    
    const s3Client = createR2S3Service();
    const presignedUrl = await s3Client.getSignedUrl(key, env.R2_BUCKET, 3600);
    
    console.log("✅ 预签名下载 URL 生成成功:", key);
    return presignedUrl;
  } catch (error) {
    console.error("❌ 预签名下载 URL 生成失败:", error);
    throw error;
  }
}

/**
 * 生成 R2 预签名 URL（用于直接上传）
 */
export async function generateR2PresignedUrl(filename: string, contentType: string): Promise<string> {
  try {
    console.log("🔗 生成 R2 预签名 URL...");
    const key = `uploads/${filename}`;
    
    const s3Client = createR2S3Service();
    const { putUrl: presignedUrl } = await s3Client.getSts(filename, {
      path: "uploads",
      ContentType: contentType,
      acl: "public-read",
    }, env.R2_BUCKET);
    
    console.log("✅ 预签名 URL 生成成功:", key);
    return presignedUrl;
  } catch (error) {
    console.error("❌ 预签名 URL 生成失败:", error);
    throw error;
  }
}

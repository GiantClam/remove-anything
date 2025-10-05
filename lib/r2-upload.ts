import AWS from 'aws-sdk';
import { nanoid } from "nanoid";
import { env } from "@/env.mjs";

/**
 * 上传文件到 Cloudflare R2 存储
 * 支持大文件上传，绕过 Vercel 限制
 */
export async function uploadToR2(file: File): Promise<string> {
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
    
    console.log("R2 配置信息:", {
      endpoint: env.R2_ENDPOINT,
      bucket: env.R2_BUCKET,
      key: key,
      bufferSize: buffer.length
    });
    
    // 上传文件到R2
    const uploadParams = {
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type
      // 注意：Cloudflare R2 可能不支持 ACL 设置
    };
    
    const result = await s3Client.upload(uploadParams).promise();
    
    // 构建公共访问URL
    const publicUrl = `${env.R2_URL_BASE}/${key}`;
    console.log("✅ 文件上传成功:", publicUrl);
    console.log("S3 上传结果:", result);
    
    return publicUrl;
  } catch (error) {
    console.error("❌ 文件上传失败:", error);
    
    // 如果是认证错误，提供更详细的调试信息
    if (error.code === 'SignatureDoesNotMatch') {
      console.error("🔍 R2 认证调试信息:");
      console.error("- R2_ENDPOINT:", env.R2_ENDPOINT);
      console.error("- R2_BUCKET:", env.R2_BUCKET);
      console.error("- R2_ACCESS_KEY 长度:", env.R2_ACCESS_KEY?.length);
      console.error("- R2_SECRET_KEY 长度:", env.R2_SECRET_KEY?.length);
      console.error("- R2_URL_BASE:", env.R2_URL_BASE);
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
    
    const s3Client = new AWS.S3({
      endpoint: env.R2_ENDPOINT,
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
      signatureVersion: 'v4',
      region: 'auto',
      s3ForcePathStyle: true,
    });
    
    const presignedUrl = s3Client.getSignedUrl('getObject', {
      Bucket: env.R2_BUCKET,
      Key: key,
      Expires: 3600, // 1小时过期
    });
    
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
    
    const s3Client = new AWS.S3({
      endpoint: env.R2_ENDPOINT,
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
      signatureVersion: 'v4',
      region: 'auto',
      s3ForcePathStyle: true,
    });
    
    const key = `uploads/${filename}`;
    
    const presignedUrl = s3Client.getSignedUrl('putObject', {
      Bucket: env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
      Expires: 3600, // 1小时过期
      // 注意：Cloudflare R2 可能不支持 ACL 设置
    });
    
    console.log("✅ 预签名 URL 生成成功:", key);
    return presignedUrl;
  } catch (error) {
    console.error("❌ 预签名 URL 生成失败:", error);
    throw error;
  }
}

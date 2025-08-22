import AWS from 'aws-sdk';
import { nanoid } from "nanoid";
import { env } from "@/env.mjs";

/**
 * 上传文件到Cloudflare R2存储
 */
export async function uploadToR2(file: File): Promise<string> {
  try {
    console.log("📤 开始上传文件到R2...");
    
    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop() || 'jpg';
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

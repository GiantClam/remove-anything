import { nanoid } from "nanoid";
import { createR2S3Service } from "@/lib/r2-s3";

/**
 * 上传文件到Cloudflare R2存储
 */
export async function uploadToR2(file: File): Promise<string> {
  let uploadKey = "";
  try {
    console.log("📤 开始上传文件到R2...");
    
    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `${nanoid(12)}.${fileExtension}`;
    const key = `uploads/${filename}`;
    uploadKey = key;
    
    // 转换文件为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const s3Client = createR2S3Service();
    
    console.log("文件大小:", buffer.length, "bytes");
    console.log("文件类型:", file.type);
    console.log("上传键:", key);
    const result = await s3Client.putItemInBucket(filename, buffer, {
      path: "uploads",
      ContentType: file.type,
      acl: "public-read",
    });
    
    const publicUrl = result.completedUrl;
    console.log("✅ 文件上传成功:", publicUrl);
    console.log("S3结果:", result);
    
    return publicUrl;
  } catch (error: any) {
    console.error("❌ 文件上传失败:", error);
    
    // 如果是认证错误，提供更详细的调试信息
    if (error?.code === 'SignatureDoesNotMatch') {
      console.error("🔍 R2认证调试信息:");
      console.error("- 上传目标键:", uploadKey);
    }
    
    throw error;
  }
}

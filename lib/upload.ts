import { nanoid } from "nanoid";
import {
  createTaskOutputR2S3Service,
  resolveTaskOutputBucket,
} from "@/lib/r2-s3";
import { env } from "@/env.mjs";

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
    
    const outputBucket = resolveTaskOutputBucket();
    const s3Client = createTaskOutputR2S3Service();

    console.log("文件大小:", buffer.length, "bytes");
    console.log("文件类型:", file.type);
    console.log("上传键:", key);
    console.log("上传桶:", outputBucket);
    // Prefer private bucket (no public ACL). Locator URL still uses R2_URL_BASE
    // so getR2ObjectKey / signed download paths keep working; anonymous CDN
    // GETs for new keys return 404 once objects live only on the private bucket.
    await s3Client.putPrivateItemInBucket(key, buffer, file.type || undefined);
    const locatorUrl = `${env.R2_URL_BASE.replace(/\/$/, "")}/${key}`;
    console.log("✅ 文件上传成功:", locatorUrl);
    return locatorUrl;
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

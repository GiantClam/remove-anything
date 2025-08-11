import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { S3Service } from "@/lib/s3";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

export async function POST(req: NextRequest) {
  try {
    // 构建时跳过
    if (shouldSkipDatabaseQuery()) {
      console.log("🔧 构建时：跳过 STS 处理");
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { key, fileType } = body;

    if (!key) {
      return NextResponse.json({ error: "Missing required parameter: key" }, { status: 400 });
    }

    // 检查R2配置
    const hasR2Config = env.R2_ENDPOINT && 
                       env.R2_ACCESS_KEY && 
                       env.R2_SECRET_KEY && 
                       env.R2_BUCKET &&
                       !env.R2_ENDPOINT.includes('placeholder') &&
                       !env.R2_ACCESS_KEY.includes('placeholder');

    if (!hasR2Config) {
      console.log("⚠️ R2配置不完整，无法生成STS令牌");
      return NextResponse.json({
        error: "Storage service temporarily unavailable"
      }, { status: 503 });
    }

    // 创建S3服务实例
    const s3Service = new S3Service({
      endpoint: env.R2_ENDPOINT,
      bucket: env.R2_BUCKET,
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
      region: env.R2_REGION || 'auto',
      url: env.R2_URL_BASE,
    });

    // 生成预签名URL
    const stsResult = await s3Service.getSts(key, {
      path: 'uploads', // 设置上传路径
      ContentType: fileType,
      acl: 'public-read',
    });

    console.log("✅ STS令牌生成成功:", { key, putUrl: stsResult.putUrl.substring(0, 100) + '...' });

    return NextResponse.json({
      data: stsResult
    });

  } catch (error) {
    console.error("❌ STS API错误:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// 保持GET方法用于健康检查
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      status: "STS service available",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
} 
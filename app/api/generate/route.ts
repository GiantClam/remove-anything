import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { nanoid } from "nanoid";

import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";
import { env } from "@/env.mjs";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "10s"
});

function getKey(id: string) {
  return `generate:${id}`;
}

export const maxDuration = 60;

type Params = { params: { key: string } };

// 简化的文件上传到R2的函数
async function uploadToR2(file: File): Promise<string> {
  try {
    console.log("📤 开始上传文件到R2...");
    
    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `${nanoid(12)}.${fileExtension}`;
    const key = `background-removal/${filename}`;
    
    // 转换文件为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 构建R2上传URL
    const uploadUrl = `${env.R2_ENDPOINT}/${env.R2_BUCKET}/${key}`;
    
    // 上传文件到R2
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.R2_ACCESS_KEY}`,
        'Content-Type': file.type,
        'x-amz-acl': 'public-read',
      },
      body: arrayBuffer,
    });
    
    if (!response.ok) {
      throw new Error(`R2 upload failed: ${response.status} ${response.statusText}`);
    }
    
    // 构建公共访问URL
    const publicUrl = `${env.R2_URL_BASE}/${key}`;
    console.log("✅ 文件上传成功:", publicUrl);
    
    return publicUrl;
  } catch (error) {
    console.error("❌ 文件上传失败:", error);
    throw error;
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  const userId = user?.id || "anonymous"; // 允许匿名用户

  const { success } = await ratelimit.limit(
    getKey(userId) + `_${req.ip ?? ""}`,
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

    // 调用AI Gateway进行背景移除
    try {
      console.log("🚀 开始调用 Cloudflare AI Gateway + Replicate 进行背景移除...");
      console.log("图片URL:", imageUrl);
      
      const result = await aiGateway.removeBackground({
        image: imageUrl,
        resolution: "", // 使用默认分辨率
      });

      if (result.error) {
        return NextResponse.json(
          { error: result.error || "Background removal failed" },
          { status: 400 },
        );
      }

      console.log('✅ AI Gateway 调用成功，结果:', result);

      // 返回处理结果
      return NextResponse.json({ 
        success: true,
        data: {
          url: result.output || imageUrl, // 返回处理后的图片URL
        }
      });
    } catch (aiError) {
      console.error("AI Gateway 调用失败:", aiError);
      throw aiError;
    }
  } catch (error) {
    console.log("error-->", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}

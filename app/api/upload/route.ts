import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { uploadToR2 } from "@/lib/upload";
import { getErrorMessage } from "@/lib/handle-error";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    console.log("🚀 开始处理图片URL上传请求...");
    console.log("用户ID:", userId || "anonymous");

    const { imageUrl } = await req.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: "No image URL provided" }, { status: 400 });
    }

    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 400 });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    // 创建 File 对象
    const imageFile = new File([imageBuffer], "image.jpg", { type: contentType });
    
    // 上传到 R2
    const uploadedUrl = await uploadToR2(imageFile);
    
    console.log("✅ 图片上传成功:", uploadedUrl);

    return NextResponse.json({
      success: true,
      url: uploadedUrl,
      message: "Image uploaded successfully"
    });

  } catch (error) {
    console.error("❌ 图片上传失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

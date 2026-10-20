import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { ImageInputError, readTrustedRemoteImage } from "@/lib/image-input";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import { uploadToR2 } from "@/lib/upload";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    console.log("🚀 开始处理图片URL上传请求...");
    console.log("用户ID:", userId || "anonymous");

    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 },
      );
    }

    const tool = getToolRegistryEntry("remove-watermark");
    if (!tool)
      return NextResponse.json(
        { error: "Tool configuration unavailable" },
        { status: 503 },
      );
    const image = await readTrustedRemoteImage(imageUrl, {
      maxBytes: tool.limits.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: tool.inputFormats,
      maxPixels: tool.limits.maxPixels,
    });

    // 上传到 R2
    const uploadedUrl = await uploadToR2(image.file);

    console.log("✅ 图片上传成功:", uploadedUrl);

    return NextResponse.json({
      success: true,
      url: uploadedUrl,
      message: "Image uploaded successfully",
    });
  } catch (error) {
    if (error instanceof ImageInputError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    console.error("❌ 图片上传失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

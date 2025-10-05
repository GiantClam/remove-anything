import { NextRequest, NextResponse } from "next/server";
import { generateR2PresignedDownloadUrl } from "@/lib/r2-upload";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    
    if (!key) {
      return NextResponse.json({ 
        error: "Missing key parameter" 
      }, { status: 400 });
    }

    console.log("🔗 生成 R2 预签名下载 URL:", key);
    
    const downloadUrl = await generateR2PresignedDownloadUrl(key);
    
    return NextResponse.json({
      success: true,
      downloadUrl,
      message: "Presigned download URL generated successfully"
    });

  } catch (error) {
    console.error("❌ 生成预签名下载 URL 失败:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to generate presigned download URL",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { generateR2PresignedUrl } from "@/lib/r2-upload";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();
    
    if (!filename || !contentType) {
      return NextResponse.json({ 
        error: "Missing filename or contentType" 
      }, { status: 400 });
    }

    console.log("🔗 生成 R2 预签名 URL:", { filename, contentType });
    
    const presignedUrl = await generateR2PresignedUrl(filename, contentType);
    
    return NextResponse.json({
      success: true,
      presignedUrl,
      message: "Presigned URL generated successfully"
    });

  } catch (error) {
    console.error("❌ 生成预签名 URL 失败:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to generate presigned URL",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

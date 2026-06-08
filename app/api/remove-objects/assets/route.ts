import { NextRequest, NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/handle-error";
import { uploadToR2 } from "@/lib/upload";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
    }

    const uploadedUrl = await uploadToR2(file);

    return NextResponse.json({
      success: true,
      url: uploadedUrl,
      contentType: file.type,
      fileName: file.name,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

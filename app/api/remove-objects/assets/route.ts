import { NextRequest, NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/handle-error";
import { ImageInputError, validateImageFile } from "@/lib/image-input";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import { uploadToR2 } from "@/lib/upload";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const tool = getToolRegistryEntry("remove-objects");
    if (!tool)
      return NextResponse.json(
        { error: "Tool configuration unavailable" },
        { status: 503 },
      );
    const image = await validateImageFile(file, {
      maxBytes: tool.limits.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: tool.inputFormats,
      maxPixels: tool.limits.maxPixels,
    });
    const uploadedUrl = await uploadToR2(image.file);

    return NextResponse.json({
      success: true,
      url: uploadedUrl,
      contentType: image.contentType,
      fileName: file.name,
    });
  } catch (error) {
    if (error instanceof ImageInputError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

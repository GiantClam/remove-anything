import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { runninghubAPI } from "@/lib/runninghub-api";
import { createWatermarkRemovalTask, updateWatermarkRemovalTask } from "@/db/queries/watermark-removal";
import { uploadToR2 } from "@/lib/upload";
import JSZip from "jszip";
import { getErrorMessage } from "@/lib/handle-error";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    console.log("🚀 开始处理去水印请求...");
    console.log("用户ID:", userId || "anonymous");

    // 检查Content-Type，支持FormData和JSON两种格式
    const contentType = req.headers.get('content-type') || '';
    
    let imageFiles: File[] = [];
    
    if (contentType.includes('multipart/form-data')) {
      // 处理FormData格式
      const formData = await req.formData();
      const images = formData.getAll('images') as File[];
      
      if (!images || images.length === 0) {
        return NextResponse.json({ error: "No images provided" }, { status: 400 });
      }

      imageFiles = images;
    } else {
      // 处理JSON格式
      const data = await req.json();
      const imageUrls = data.imageUrls || [];
      
      if (!imageUrls || imageUrls.length === 0) {
        return NextResponse.json({ error: "No image URLs provided" }, { status: 400 });
      }

      // 对于JSON格式，我们需要下载图片并转换为File对象
      // 这里简化处理，要求前端提供FormData
      return NextResponse.json({ error: "Please use FormData for image uploads" }, { status: 400 });
    }

    console.log(`📸 收到 ${imageFiles.length} 张图片`);

    // 创建ZIP文件
    const zip = new JSZip();
    
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `image_${i + 1}.${extension}`;
      
      const arrayBuffer = await file.arrayBuffer();
      zip.file(fileName, arrayBuffer);
    }

    // 生成ZIP文件
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log("📦 ZIP文件创建成功，大小:", zipBuffer.length, "bytes");

    // 上传ZIP文件到R2
    let zipUrl: string;
    try {
      // 创建一个临时的Blob来上传
      const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
      const zipFile = new File([zipBlob], 'images.zip', { type: 'application/zip' });
      
      zipUrl = await uploadToR2(zipFile);
      console.log("✅ ZIP文件上传到R2成功:", zipUrl);
    } catch (uploadError) {
      console.error("❌ ZIP文件上传到R2失败:", uploadError);
      return NextResponse.json({ error: "Failed to upload ZIP file" }, { status: 500 });
    }

    // 上传ZIP文件到RunningHub
    let filename: string;
    try {
      filename = await runninghubAPI.uploadZip(zipBuffer);
    } catch (uploadError) {
      console.error("❌ ZIP文件上传到RunningHub失败:", uploadError);
      return NextResponse.json({ error: "Failed to upload to RunningHub" }, { status: 500 });
    }

    // 先创建任务记录（用于 webhook 回调）
    let taskRecord;
    try {
      taskRecord = await createWatermarkRemovalTask({
        userId: userId || undefined,
        runninghubTaskId: "pending", // 临时值，稍后更新
        inputZipUrl: zipUrl,
      });
    } catch (dbError) {
      console.error("❌ 创建任务记录失败:", dbError);
      return NextResponse.json({ error: "Failed to create task record" }, { status: 500 });
    }

    // 创建去水印任务（包含 webhook URL）
    let taskId: string;
    try {
      taskId = await runninghubAPI.createWatermarkRemovalTask(filename, taskRecord.id);
    } catch (createError) {
      console.error("❌ 创建去水印任务失败:", createError);
      return NextResponse.json({ error: "Failed to create watermark removal task" }, { status: 500 });
    }

    // 更新任务记录中的 runninghubTaskId
    try {
      await updateWatermarkRemovalTask(taskRecord.id, {
        runninghubTaskId: taskId,
      });
    } catch (updateError) {
      console.error("❌ 更新任务记录失败:", updateError);
      // 不返回错误，因为任务已经创建成功
    }

    console.log("✅ 去水印任务创建成功:", {
      taskId,
      taskRecordId: taskRecord.id,
      userId: userId || "anonymous"
    });

    return NextResponse.json({
      success: true,
      taskId,
      taskRecordId: taskRecord.id,
      message: "Watermark removal task created successfully"
    });

  } catch (error) {
    console.error("❌ 去水印处理失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

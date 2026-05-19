import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/handle-error";
import { runninghubAPI } from "@/modules/runninghub";
import { findWatermarkRemovalTaskByRunningHubId, updateWatermarkRemovalTask } from "@/db/queries/watermark-removal";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import JSZip from "jszip";
import { nanoid } from "nanoid";
import { env } from "@/env.mjs";
import { createR2S3Service } from "@/lib/r2-s3";

// 强制动态渲染，避免构建时静态生成
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const { searchParams } = new URL(req.url);
    const dbOnly = searchParams.get('dbOnly') === 'true';
    
    console.log("🔍 开始查询去水印任务状态");
    console.log("📋 请求参数:", { taskId, dbOnly, url: req.url });
    
    if (!taskId) {
      console.log("❌ 缺少taskId参数");
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    console.log("🔍 查询去水印任务状态:", taskId, dbOnly ? "(仅数据库)" : "(包含RunningHub)");

    // 首先从数据库查询任务记录
    const taskRecord = await findWatermarkRemovalTaskByRunningHubId(taskId);
    
    if (!taskRecord) {
      console.log("❌ 未找到去水印任务记录:", taskId);
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    console.log("✅ 找到去水印任务记录:", {
      id: taskRecord.id,
      userId: taskRecord.userId || "anonymous",
      status: taskRecord.taskStatus
    });

    // 如果只查询数据库状态，直接返回
    if (dbOnly) {
      return NextResponse.json({
        success: true,
        id: taskRecord.id,
        runninghubTaskId: taskId,
        taskStatus: taskRecord.taskStatus,
        inputZipUrl: taskRecord.inputZipUrl,
        outputZipUrl: taskRecord.outputZipUrl,
        errorMsg: taskRecord.errorMsg,
        createdAt: taskRecord.createdAt,
        executeStartTime: taskRecord.executeStartTime?.toString(),
        executeEndTime: taskRecord.executeEndTime?.toString()
      });
    }

    let finalStatus = taskRecord.taskStatus;
    let outputZipUrl = taskRecord.outputZipUrl as string | null;
    let outputImageUrls: string[] | undefined;

    // 如果任务还在进行中，从RunningHub获取最新状态
    if (['pending', 'starting', 'processing'].includes(taskRecord.taskStatus)) {
      try {
        console.log(`🔍 任务状态为 ${taskRecord.taskStatus}，从RunningHub获取最新状态...`);
        const runninghubStatus = await runninghubAPI.getTaskStatus(taskId);
        
        console.log(`📊 RunningHub状态: ${runninghubStatus.data?.status || runninghubStatus.data}, 数据库状态: ${taskRecord.taskStatus}`);
        
        // 同步数据库状态与RunningHub状态
        let updateData: any = {};
        
        switch (runninghubStatus.data?.status || runninghubStatus.data) {
          case 'starting':
          case 'STARTING':
            // 如果数据库状态是pending，更新为starting
            if (taskRecord.taskStatus === 'pending') {
              updateData = {
                taskStatus: 'starting',
                executeStartTime: BigInt(Date.now())
              };
            }
            break;
            
          case 'processing':
          case 'PROCESSING':
          case 'RUNNING':
            // 无论数据库状态是什么，都更新为processing
            updateData = {
              taskStatus: 'processing'
            };
            break;
            
          case 'succeeded':
          case 'SUCCESS':
            try {
              // 当任务成功时，获取任务结果
              console.log(`🔍 任务成功，获取任务结果...`);
              const taskResult = await runninghubAPI.getTaskResult(taskId);
              
              if (taskResult.data && Array.isArray(taskResult.data) && taskResult.data.length > 0) {
                const outputFile = taskResult.data[0];
                outputZipUrl = outputFile.fileUrl || null;
                updateData = {
                  taskStatus: 'succeeded',
                  outputZipUrl,
                  executeEndTime: BigInt(Date.now())
                };
                console.log(`✅ 任务成功完成，输出URL: ${outputFile.fileUrl}`);
              } else {
                updateData = {
                  taskStatus: 'succeeded',
                  executeEndTime: BigInt(Date.now())
                };
                console.log(`✅ 任务成功完成，但无输出文件`);
              }
            } catch (resultError) {
              console.error("❌ 获取任务结果失败:", resultError);
              // 即使获取结果失败，也标记任务为成功
              updateData = {
                taskStatus: 'succeeded',
                executeEndTime: BigInt(Date.now())
              };
            }
            break;
            
          case 'failed':
          case 'FAILED':
            updateData = {
              taskStatus: 'failed',
              executeEndTime: BigInt(Date.now()),
              errorMsg: runninghubStatus.data?.error || 'Task failed'
            };
            console.log(`❌ 任务失败: ${runninghubStatus.data?.error}`);
            break;
            
          case 'pending':
          case 'QUEUED':
            // 保持pending状态，不需要更新
            break;
            
          default:
            console.log(`ℹ️ 未知状态: ${runninghubStatus.data?.status || runninghubStatus.data}`);
            break;
        }
        
        // 如果有更新数据，更新数据库记录
        if (Object.keys(updateData).length > 0) {
          try {
            await updateWatermarkRemovalTask(taskRecord.id, updateData);
            console.log(`🔄 已更新 WatermarkRemovalTask 记录: ${taskRecord.id}，状态: ${updateData.taskStatus}`);
            finalStatus = updateData.taskStatus;
          } catch (dbError) {
            console.error("❌ 数据库更新失败:", {
              error: dbError.message,
              taskRecordId: taskRecord.id,
              updateData: updateData
            });
          }
        }
        
      } catch (statusError) {
        console.error("❌ 从RunningHub获取状态失败:", statusError);
        // 如果获取状态失败，继续使用数据库状态
        finalStatus = taskRecord.taskStatus;
      }
    }

    // 若已成功并拿到 ZIP，尝试解压并将图片保存到 R2，以便前端直接展示
    if (finalStatus === 'succeeded' && outputZipUrl) {
      try {
        console.log("📥 下载任务输出以提取图片:", outputZipUrl);
        const fileRes = await fetch(outputZipUrl);
        if (fileRes.ok) {
          const contentType = fileRes.headers.get('content-type') || '';

          const s3 = createR2S3Service();
          const folderPrefix = `watermark-removal/processed/${taskId}-${nanoid(6)}`;

          const downloadedArrayBuffer = await fileRes.arrayBuffer();
          const magic = new Uint8Array(downloadedArrayBuffer);
          const isZipMagic = magic.length >= 2 && magic[0] === 0x50 && magic[1] === 0x4b;

          if (contentType.includes('zip') && isZipMagic) {
            // ZIP：解压多图
            const zip = await JSZip.loadAsync(downloadedArrayBuffer);
            const entries = Object.values(zip.files).filter(f => !f.dir);

            const uploaded = await Promise.all(entries.map(async (entry, index) => {
              const arrayBuffer = await entry.async('arraybuffer');
              const buffer = Buffer.from(arrayBuffer);
              const ext = entry.name.split('.').pop() || 'png';
              const key = `${folderPrefix}/image_${index + 1}.${ext}`;

              await s3.putItemInBucket(`image_${index + 1}.${ext}`, buffer, {
                path: folderPrefix,
                ContentType: `image/${ext}`,
                acl: "public-read",
              });

              return `${env.R2_URL_BASE}/${key}`;
            }));

            outputImageUrls = uploaded;
            console.log("✅ 已解压并上传图片到R2:", uploaded.length);
          } else if (contentType.startsWith('image/')) {
            // 单图：直接转存为一张图片
            const buffer = Buffer.from(downloadedArrayBuffer);
            const ext = contentType.split('/')[1] || 'png';
            const key = `${folderPrefix}/image_1.${ext}`;

            await s3.putItemInBucket(`image_1.${ext}`, buffer, {
              path: folderPrefix,
              ContentType: `image/${ext}`,
              acl: "public-read",
            });

            outputImageUrls = [`${env.R2_URL_BASE}/${key}`];
            console.log("✅ 已转存单张图片到R2:", outputImageUrls[0]);
          } else if (contentType.includes('zip') && !isZipMagic) {
            // 标称zip但实际不是：将其当作单文件按通用扩展名转存
            const guessedExt = 'png';
            const buffer = Buffer.from(downloadedArrayBuffer);
            const key = `${folderPrefix}/image_1.${guessedExt}`;

            await s3.putItemInBucket(`image_1.${guessedExt}`, buffer, {
              path: folderPrefix,
              ContentType: `image/${guessedExt}`,
              acl: "public-read",
            });

            outputImageUrls = [`${env.R2_URL_BASE}/${key}`];
            console.log('⚠️ 输出声明为zip但魔数不匹配，已按单图处理');
          } else {
            console.log('ℹ️ 输出为非ZIP/非图片类型，保持仅提供原始链接');
          }
        }
      } catch (extractErr) {
        console.error("⚠️ 解压或上传输出图片失败，忽略并继续返回ZIP:", extractErr);
      }
    }

    return NextResponse.json({
      success: true,
      id: taskRecord.id,
      runninghubTaskId: taskId,
      taskStatus: finalStatus,
      inputZipUrl: taskRecord.inputZipUrl,
      outputZipUrl: outputZipUrl || taskRecord.outputZipUrl,
      outputImageUrls,
      errorMsg: taskRecord.errorMsg,
      createdAt: taskRecord.createdAt,
      executeStartTime: taskRecord.executeStartTime?.toString(),
      executeEndTime: taskRecord.executeEndTime?.toString()
    });

  } catch (error) {
    console.error("❌ 查询去水印任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

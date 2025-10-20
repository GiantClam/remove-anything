import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";
import { runninghubAPI } from "@/lib/runninghub-api";
import AWS from 'aws-sdk';
import { env } from "@/env.mjs";
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const taskId = params.taskId;
  
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  // 设置 SSE 响应头
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      let intervalId: NodeJS.Timeout;
      let attempts = 0;
      const maxAttempts = 120; // 20分钟
      
      const checkTaskStatus = async () => {
        try {
          attempts++;
          console.log(`🔍 SSE 检查任务状态: ${taskId} (第${attempts}次)`);
          
          // 查询任务状态
          const taskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
          
          if (!taskRecord) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: "Task not found",
              status: "error" 
            })}\n\n`));
            controller.close();
            return;
          }

          // 如果任务还在进行中，主动检查 RunningHub 状态
          if (['pending', 'starting', 'processing'].includes(taskRecord.taskStatus)) {
            console.log(`🔄 任务进行中，检查 RunningHub 状态: ${taskId}`);
            
            try {
              const statusResp = await runninghubAPI.getTaskStatus(taskId);
              console.log(`📡 RunningHub 状态响应:`, JSON.stringify(statusResp, null, 2));
              
              let status: string | undefined;
              if (statusResp && typeof statusResp === 'object') {
                if (statusResp.code === 0 && statusResp.data) {
                  if (typeof statusResp.data === 'string') {
                    status = statusResp.data;
                  } else if (statusResp.data && typeof statusResp.data.status === 'string') {
                    status = statusResp.data.status;
                  }
                }
              }
              
              console.log(`📊 解析的 RunningHub 状态: ${status}`);
              
              if (status === 'SUCCESS' || status === 'succeeded') {
                // 获取结果并更新数据库
                console.log(`🎯 任务成功，获取结果: ${taskId}`);
                const result = await runninghubAPI.getTaskResult(taskId);
                let outputUrl: string | null = null;
                
                if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
                  const remoteUrl = result.data[0]?.fileUrl || null;
                  // 下载并转存到 R2
                  try {
                    const resp = await fetch(remoteUrl!);
                    if (resp.ok) {
                      const arrayBuffer = await resp.arrayBuffer();
                      const contentType = resp.headers.get('content-type') || 'image/png';
                      const s3 = new AWS.S3({
                        endpoint: env.R2_ENDPOINT,
                        accessKeyId: env.R2_ACCESS_KEY,
                        secretAccessKey: env.R2_SECRET_KEY,
                        region: env.R2_REGION || 'auto',
                        s3ForcePathStyle: true,
                      });
                      const key = `background-removal/processed/${taskId}-${nanoid(8)}.png`;
                      await s3.upload({ Bucket: env.R2_BUCKET, Key: key, Body: Buffer.from(arrayBuffer), ContentType: contentType }).promise();
                      outputUrl = `${env.R2_URL_BASE}/${key}`;
                    } else {
                      outputUrl = remoteUrl;
                    }
                  } catch (e) {
                    console.error('SSE R2 upload error:', e);
                    outputUrl = remoteUrl;
                  }
                }
                
                // 更新数据库
                await prisma.backgroundRemovalTask.update({
                  where: { replicateId: taskId },
                  data: {
                    taskStatus: 'succeeded',
                    outputImageUrl: outputUrl,
                    executeEndTime: BigInt(Date.now())
                  }
                });
                
                console.log(`✅ 数据库已更新: ${taskId} -> succeeded`);
                
              } else if (status === 'FAILED' || status === 'failed') {
                // 更新数据库为失败
                await prisma.backgroundRemovalTask.update({
                  where: { replicateId: taskId },
                  data: {
                    taskStatus: 'failed',
                    executeEndTime: BigInt(Date.now()),
                    errorMsg: 'Task failed on RunningHub'
                  }
                });
                
                console.log(`❌ 数据库已更新: ${taskId} -> failed`);
                
              } else if (status === 'RUNNING' || status === 'running' || status === 'Processing' || status === 'processing') {
                // 更新数据库为处理中
                await prisma.backgroundRemovalTask.update({
                  where: { replicateId: taskId },
                  data: {
                    taskStatus: 'processing',
                    executeStartTime: BigInt(Date.now())
                  }
                });
                
                console.log(`🔄 数据库已更新: ${taskId} -> processing`);
              }
              
            } catch (apiError) {
              console.error(`❌ RunningHub API 调用失败: ${taskId}`, apiError);
            }
          }

          // 重新查询更新后的任务状态
          const updatedTaskRecord = await findBackgroundRemovalTaskByReplicateId(taskId);
          
          const statusData = {
            taskId: taskId,
            status: updatedTaskRecord?.taskStatus || taskRecord.taskStatus,
            output: updatedTaskRecord?.outputImageUrl || taskRecord.outputImageUrl,
            error: updatedTaskRecord?.errorMsg || taskRecord.errorMsg,
            attempts: attempts,
            maxAttempts: maxAttempts
          };

          console.log(`📤 SSE 发送状态:`, statusData);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusData)}\n\n`));

          // 如果任务完成或失败，关闭连接
          if (statusData.status === 'succeeded' || statusData.status === 'failed') {
            console.log(`✅ SSE 任务完成: ${taskId} -> ${statusData.status}`);
            clearInterval(intervalId);
            controller.close();
            return;
          }

          // 如果超过最大尝试次数，关闭连接
          if (attempts >= maxAttempts) {
            console.log(`⏰ SSE 超时: ${taskId}`);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              error: "Task timeout",
              status: "timeout" 
            })}\n\n`));
            clearInterval(intervalId);
            controller.close();
            return;
          }

        } catch (error) {
          console.error(`❌ SSE 检查任务状态失败: ${taskId}`, error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            error: "Check failed",
            status: "error" 
          })}\n\n`));
        }
      };

      // 立即检查一次
      checkTaskStatus();
      
      // 然后每3秒检查一次
      intervalId = setInterval(checkTaskStatus, 3000);

      // 处理客户端断开连接
      req.signal?.addEventListener('abort', () => {
        console.log(`🔌 SSE 客户端断开连接: ${taskId}`);
        clearInterval(intervalId);
        controller.close();
      });
    }
  });

  return new Response(stream, { headers });
}

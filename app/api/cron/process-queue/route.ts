import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/prisma";
import { taskProcessor } from "@/lib/task-processor";
import { runninghubAPI } from "@/lib/runninghub-api";

function computeBackoffMs(retryCount: number): number {
  const steps = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
  return steps[Math.min(retryCount, steps.length - 1)];
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const batchSize = Number(process.env.QUEUE_BATCH_SIZE || 5);
  let processed = 0;
  let synced = 0;

  try {
    // 1. 处理队列中的任务
    const now = new Date();
    const tasks = await (prisma as any).processingQueue.findMany({
      where: { status: 'pending', scheduledAt: { lte: now } },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    for (const t of tasks) {
      // 标记为 running
      await (prisma as any).processingQueue.update({
        where: { id: t.id },
        data: { status: 'running' },
      });

      try {
        if (t.taskType === 'sora2-video-watermark-removal') {
          await taskProcessor.processSora2VideoWatermarkRemoval({ metadata: t.payload, id: `cron_${t.id}` });
        }
        await (prisma as any).processingQueue.update({ where: { id: t.id }, data: { status: 'completed' } });
        processed++;
      } catch (e: any) {
        const nextDelay = computeBackoffMs(t.retryCount || 0);
        await (prisma as any).processingQueue.update({
          where: { id: t.id },
          data: {
            status: 'pending',
            retryCount: (t.retryCount || 0) + 1,
            lastError: String(e?.message || e),
            scheduledAt: new Date(Date.now() + nextDelay),
          },
        });
      }
    }

    // 2. 同步 RunningHub 任务状态 - 优化版本
    const now = Date.now();
    const syncThreshold = 10 * 1000; // 10秒后开始同步，更激进
    
    // 同步背景去除任务
    const backgroundTasks = await prisma.backgroundRemovalTask.findMany({
      where: { 
        taskStatus: 'processing',
        executeStartTime: { 
          lt: BigInt(now - syncThreshold)
        }
      },
      take: 5,
      orderBy: { executeStartTime: 'asc' }
    });

    for (const task of backgroundTasks) {
      try {
        if (!task.replicateId) continue;

        console.log(`🔄 同步背景去除任务: ${task.replicateId}`);
        
        // 查询 Replicate 状态
        const statusResp = await runninghubAPI.getTaskStatus(task.replicateId);
        let status: string | undefined;
        
        if (typeof (statusResp as any)?.data === 'string') {
          status = (statusResp as any).data as string;
        } else if ((statusResp as any)?.data && typeof (statusResp as any).data.status === 'string') {
          status = (statusResp as any).data.status as string;
        } else if ((statusResp as any)?.data && typeof (statusResp as any).data === 'object') {
          status = (statusResp as any).data.status || (statusResp as any).data;
        }

        if (status === 'SUCCESS' || status === 'succeeded') {
          // 获取结果
          const result = await runninghubAPI.getTaskResult(task.replicateId);
          
          if (result.code === 804 && result.msg === 'APIKEY_TASK_IS_RUNNING') {
            console.log(`ℹ️ 背景去除任务仍在运行: ${task.replicateId}`);
            continue;
          }

          let updateData: any = {
            taskStatus: "succeeded",
            executeEndTime: BigInt(now)
          };

          if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
            const outputFile = result.data[0];
            updateData.outputImageUrl = outputFile.fileUrl;
          }

          await prisma.backgroundRemovalTask.update({
            where: { replicateId: task.replicateId },
            data: updateData
          });

          console.log(`✅ 背景去除任务同步成功: ${task.replicateId}`);
          synced++;
        } else if (status === 'FAILED' || status === 'failed') {
          await prisma.backgroundRemovalTask.update({
            where: { replicateId: task.replicateId },
            data: {
              taskStatus: "failed",
              executeEndTime: BigInt(now),
              errorMsg: "Task failed on RunningHub"
            }
          });
          console.log(`❌ 背景去除任务同步失败: ${task.replicateId}`);
          synced++;
        }
      } catch (error) {
        console.error(`❌ 同步背景去除任务失败 ${task.replicateId}:`, error);
      }
    }

    // 同步去水印任务
    const watermarkTasks = await prisma.watermarkRemovalTask.findMany({
      where: { 
        taskStatus: 'processing',
        executeStartTime: { 
          lt: BigInt(now - syncThreshold)
        }
      },
      take: 5,
      orderBy: { executeStartTime: 'asc' }
    });

    for (const task of watermarkTasks) {
      try {
        if (!task.runninghubTaskId) continue;

        console.log(`🔄 同步去水印任务: ${task.runninghubTaskId}`);
        
        // 查询 RunningHub 状态
        const statusResp = await runninghubAPI.getTaskStatus(task.runninghubTaskId);
        let status: string | undefined;
        
        if (typeof (statusResp as any)?.data === 'string') {
          status = (statusResp as any).data as string;
        } else if ((statusResp as any)?.data && typeof (statusResp as any).data.status === 'string') {
          status = (statusResp as any).data.status as string;
        } else if ((statusResp as any)?.data && typeof (statusResp as any).data === 'object') {
          status = (statusResp as any).data.status || (statusResp as any).data;
        }

        if (status === 'SUCCESS' || status === 'succeeded') {
          // 获取结果
          const result = await runninghubAPI.getTaskResult(task.runninghubTaskId);
          
          if (result.code === 804 && result.msg === 'APIKEY_TASK_IS_RUNNING') {
            console.log(`ℹ️ 去水印任务仍在运行: ${task.runninghubTaskId}`);
            continue;
          }

          let updateData: any = {
            taskStatus: "succeeded",
            executeEndTime: BigInt(now)
          };

          if (result?.data && Array.isArray(result.data) && result.data.length > 0) {
            const outputFile = result.data[0];
            updateData.outputZipUrl = outputFile.fileUrl;
          }

          await prisma.watermarkRemovalTask.update({
            where: { id: task.id },
            data: updateData
          });

          console.log(`✅ 去水印任务同步成功: ${task.runninghubTaskId}`);
          synced++;
        } else if (status === 'FAILED' || status === 'failed') {
          await prisma.watermarkRemovalTask.update({
            where: { id: task.id },
            data: {
              taskStatus: "failed",
              executeEndTime: BigInt(now),
              errorMsg: "Task failed on RunningHub"
            }
          });
          console.log(`❌ 去水印任务同步失败: ${task.runninghubTaskId}`);
          synced++;
        }
      } catch (error) {
        console.error(`❌ 同步去水印任务失败 ${task.runninghubTaskId}:`, error);
      }
    }

    return NextResponse.json({ 
      processed, 
      synced,
      message: `Processed ${processed} queue tasks, synced ${synced} RunningHub tasks`
    });

  } catch (error) {
    console.error("❌ Cron job error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}



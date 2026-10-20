import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/db/prisma";
import { taskProcessor } from "@/lib/task-processor";
import {
  claimVideoQueueItem,
  dispatchVideoQueueItem,
} from "@/lib/video-task-queue-contract";
import { runninghubAPI } from "@/modules/runninghub";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 设置超时保护 - 25秒后强制返回
  const timeoutId = setTimeout(() => {
    console.log("⏰ Cron job timeout, returning partial results");
  }, 25000);

  const batchSize = Number(process.env.QUEUE_BATCH_SIZE || 3); // 减少批次大小
  let processed = 0;
  let synced = 0;

  try {
    // 1. 处理队列中的任务
    const now = new Date();
    const tasks = await (prisma as any).processingQueue.findMany({
      where: { status: "pending", scheduledAt: { lte: now } },
      take: batchSize,
      orderBy: { createdAt: "asc" },
    });

    for (const t of tasks) {
      // Claim atomically so overlapping cron invocations cannot both submit
      // the same paid provider task.
      const claimed = await claimVideoQueueItem(
        {
          id: t.id,
          scheduledAt: t.scheduledAt,
          retryCount: t.retryCount,
        },
        (args) => (prisma as any).processingQueue.updateMany(args),
      );
      if (!claimed) continue;

      const outcome = await dispatchVideoQueueItem(t, {
        updateQueueItem: async (id, data) => {
          await (prisma as any).processingQueue.update({
            where: { id },
            data,
          });
        },
        processSora2VideoWatermarkRemoval: (task) =>
          taskProcessor.processSora2VideoWatermarkRemoval(task),
      });
      if (outcome === "completed") processed++;
    }

    // 2. 同步 RunningHub 任务状态 - 优化版本
    const nowMs = Date.now();
    const syncThreshold = 10 * 1000; // 10秒后开始同步，更激进

    // 同步背景去除任务 - 包括所有非最终状态和成功但缺少结果的任务
    const backgroundTasks = await prisma.backgroundRemovalTask.findMany({
      where: {
        OR: [
          // 非最终状态的任务
          {
            taskStatus: { in: ["pending", "starting", "processing"] },
            OR: [
              { executeStartTime: { lt: BigInt(nowMs - syncThreshold) } },
              { executeStartTime: null },
            ],
          },
          // 成功但缺少结果的任务
          {
            taskStatus: "succeeded",
            outputImageUrl: null,
          },
        ],
      },
      take: 5,
      orderBy: { createdAt: "asc" },
    });

    for (const task of backgroundTasks) {
      try {
        if (!task.replicateId) continue;

        console.log(`🔄 同步背景去除任务: ${task.replicateId}`);

        // 查询 Replicate 状态
        const statusResp = await runninghubAPI.getTaskStatus(task.replicateId);
        let status: string | undefined;

        if (typeof (statusResp as any)?.data === "string") {
          status = (statusResp as any).data as string;
        } else if (
          (statusResp as any)?.data &&
          typeof (statusResp as any).data.status === "string"
        ) {
          status = (statusResp as any).data.status as string;
        } else if (
          (statusResp as any)?.data &&
          typeof (statusResp as any).data === "object"
        ) {
          status = (statusResp as any).data.status || (statusResp as any).data;
        }

        if (status === "SUCCESS" || status === "succeeded") {
          // 获取结果
          const result = await runninghubAPI.getTaskResult(task.replicateId);

          if (result.code === 804 && result.msg === "APIKEY_TASK_IS_RUNNING") {
            console.log(`ℹ️ 背景去除任务仍在运行: ${task.replicateId}`);
            continue;
          }

          let updateData: any = {
            taskStatus: "succeeded",
            executeEndTime: BigInt(nowMs),
          };

          if (
            result?.data &&
            Array.isArray(result.data) &&
            result.data.length > 0
          ) {
            const outputFile = result.data[0];
            updateData.outputImageUrl = outputFile.fileUrl;
            console.log(`📦 获取到结果URL: ${outputFile.fileUrl}`);
          }

          // 只有当结果发生变化时才更新数据库
          const needsUpdate =
            task.taskStatus !== "succeeded" ||
            (result?.data &&
              Array.isArray(result.data) &&
              result.data.length > 0 &&
              !task.outputImageUrl);

          if (needsUpdate) {
            await prisma.backgroundRemovalTask.update({
              where: { replicateId: task.replicateId },
              data: updateData,
            });
            console.log(`✅ 背景去除任务同步成功: ${task.replicateId}`);
            synced++;
          } else {
            console.log(`ℹ️ 背景去除任务已是最新状态: ${task.replicateId}`);
          }
        } else if (status === "FAILED" || status === "failed") {
          await prisma.backgroundRemovalTask.update({
            where: { replicateId: task.replicateId },
            data: {
              taskStatus: "failed",
              executeEndTime: BigInt(nowMs),
              errorMsg: "Task failed on RunningHub",
            },
          });
          console.log(`❌ 背景去除任务同步失败: ${task.replicateId}`);
          synced++;
        } else if (
          status === "RUNNING" ||
          status === "running" ||
          status === "Processing" ||
          status === "processing"
        ) {
          // 更新为处理中状态
          await prisma.backgroundRemovalTask.update({
            where: { replicateId: task.replicateId },
            data: {
              taskStatus: "processing",
              executeStartTime: BigInt(nowMs),
            },
          });
          console.log(`🔄 背景去除任务更新为处理中: ${task.replicateId}`);
          synced++;
        } else if (
          status === "PENDING" ||
          status === "pending" ||
          status === "QUEUED" ||
          status === "queued"
        ) {
          // 更新为开始状态
          await prisma.backgroundRemovalTask.update({
            where: { replicateId: task.replicateId },
            data: {
              taskStatus: "starting",
              executeStartTime: BigInt(nowMs),
            },
          });
          console.log(`⏳ 背景去除任务更新为开始中: ${task.replicateId}`);
          synced++;
        }
      } catch (error) {
        console.error(`❌ 同步背景去除任务失败 ${task.replicateId}:`, error);
      }
    }

    // 同步去水印任务 - 包括所有非最终状态和成功但缺少结果的任务
    const watermarkTasks = await prisma.watermarkRemovalTask.findMany({
      where: {
        OR: [
          // 非最终状态的任务
          {
            taskStatus: { in: ["pending", "starting", "processing"] },
            OR: [
              { executeStartTime: { lt: BigInt(nowMs - syncThreshold) } },
              { executeStartTime: null },
            ],
          },
          // 成功但缺少结果的任务
          {
            taskStatus: "succeeded",
            outputZipUrl: null,
          },
        ],
      },
      take: 5,
      orderBy: { createdAt: "asc" },
    });

    for (const task of watermarkTasks) {
      try {
        if (!task.runninghubTaskId) continue;

        console.log(`🔄 同步去水印任务: ${task.runninghubTaskId}`);

        // 查询 RunningHub 状态
        const statusResp = await runninghubAPI.getTaskStatus(
          task.runninghubTaskId,
        );
        let status: string | undefined;

        if (typeof (statusResp as any)?.data === "string") {
          status = (statusResp as any).data as string;
        } else if (
          (statusResp as any)?.data &&
          typeof (statusResp as any).data.status === "string"
        ) {
          status = (statusResp as any).data.status as string;
        } else if (
          (statusResp as any)?.data &&
          typeof (statusResp as any).data === "object"
        ) {
          status = (statusResp as any).data.status || (statusResp as any).data;
        }

        if (status === "SUCCESS" || status === "succeeded") {
          // 获取结果
          const result = await runninghubAPI.getTaskResult(
            task.runninghubTaskId,
          );

          if (result.code === 804 && result.msg === "APIKEY_TASK_IS_RUNNING") {
            console.log(`ℹ️ 去水印任务仍在运行: ${task.runninghubTaskId}`);
            continue;
          }

          let updateData: any = {
            taskStatus: "succeeded",
            executeEndTime: BigInt(nowMs),
          };

          if (
            result?.data &&
            Array.isArray(result.data) &&
            result.data.length > 0
          ) {
            const outputFile = result.data[0];
            updateData.outputZipUrl = outputFile.fileUrl;
            console.log(`📦 获取到结果URL: ${outputFile.fileUrl}`);
          }

          // 只有当结果发生变化时才更新数据库
          const needsUpdate =
            task.taskStatus !== "succeeded" ||
            (result?.data &&
              Array.isArray(result.data) &&
              result.data.length > 0 &&
              !task.outputZipUrl);

          if (needsUpdate) {
            await prisma.watermarkRemovalTask.update({
              where: { id: task.id },
              data: updateData,
            });
            console.log(`✅ 去水印任务同步成功: ${task.runninghubTaskId}`);
            synced++;
          } else {
            console.log(`ℹ️ 去水印任务已是最新状态: ${task.runninghubTaskId}`);
          }
        } else if (status === "FAILED" || status === "failed") {
          await prisma.watermarkRemovalTask.update({
            where: { id: task.id },
            data: {
              taskStatus: "failed",
              executeEndTime: BigInt(nowMs),
              errorMsg: "Task failed on RunningHub",
            },
          });
          console.log(`❌ 去水印任务同步失败: ${task.runninghubTaskId}`);
          synced++;
        } else if (
          status === "RUNNING" ||
          status === "running" ||
          status === "Processing" ||
          status === "processing"
        ) {
          // 更新为处理中状态
          await prisma.watermarkRemovalTask.update({
            where: { id: task.id },
            data: {
              taskStatus: "processing",
              executeStartTime: BigInt(nowMs),
            },
          });
          console.log(`🔄 去水印任务更新为处理中: ${task.runninghubTaskId}`);
          synced++;
        } else if (
          status === "PENDING" ||
          status === "pending" ||
          status === "QUEUED" ||
          status === "queued"
        ) {
          // 更新为开始状态
          await prisma.watermarkRemovalTask.update({
            where: { id: task.id },
            data: {
              taskStatus: "starting",
              executeStartTime: BigInt(nowMs),
            },
          });
          console.log(`⏳ 去水印任务更新为开始中: ${task.runninghubTaskId}`);
          synced++;
        }
      } catch (error) {
        console.error(`❌ 同步去水印任务失败 ${task.runninghubTaskId}:`, error);
      }
    }

    clearTimeout(timeoutId);
    return NextResponse.json({
      processed,
      synced,
      message: `Processed ${processed} queue tasks, synced ${synced} RunningHub tasks`,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("❌ Cron job error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

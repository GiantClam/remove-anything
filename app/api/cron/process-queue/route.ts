import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/db/prisma";
import { taskProcessor } from "@/lib/task-processor";
import {
  claimVideoQueueItem,
  dispatchVideoQueueItem,
  recoverStaleVideoQueueItemInTransaction,
  recoverStaleVideoQueueItems,
  VIDEO_QUEUE_MIN_TASK_WINDOW_MS,
  VIDEO_QUEUE_RUN_BUDGET_MS,
  VIDEO_QUEUE_TASK_TYPE_FILTER,
} from "@/lib/video-task-queue-contract";
import { runninghubAPI } from "@/modules/runninghub";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const hardDeadline = startedAt + 55_000;
  const deadlineAt = startedAt + VIDEO_QUEUE_RUN_BUDGET_MS;
  const timeoutId = setTimeout(() => {
    console.log("⏰ Cron job is approaching its configured deadline");
  }, VIDEO_QUEUE_RUN_BUDGET_MS);

  const configuredBatchSize = Number(process.env.QUEUE_BATCH_SIZE || 3);
  const batchSize = Number.isFinite(configuredBatchSize)
    ? Math.max(1, Math.min(3, Math.floor(configuredBatchSize)))
    : 3;
  let processed = 0;
  let synced = 0;
  let recovered = 0;

  try {
    recovered = await recoverStaleVideoQueueItems(
      (args) => (prisma as any).processingQueue.findMany(args),
      (item, cutoff, recoveredAt) =>
        (prisma as any).$transaction(async (tx: any) => {
          return recoverStaleVideoQueueItemInTransaction(
            tx,
            item,
            cutoff,
            recoveredAt,
          );
        }),
    );

    // 1. 处理队列中的任务
    const now = new Date();
    const tasks = await (prisma as any).processingQueue.findMany({
      where: {
        ...VIDEO_QUEUE_TASK_TYPE_FILTER,
        status: "pending",
        scheduledAt: { lte: now },
      },
      take: batchSize,
      orderBy: { createdAt: "asc" },
    });

    for (const t of tasks) {
      if (Date.now() + VIDEO_QUEUE_MIN_TASK_WINDOW_MS >= deadlineAt) break;
      // Claim atomically so overlapping cron invocations cannot both submit
      // the same paid provider task.
      const claimedAt = await claimVideoQueueItem(
        {
          id: t.id,
          taskType: t.taskType,
          scheduledAt: t.scheduledAt,
          retryCount: t.retryCount,
        },
        (args) => (prisma as any).processingQueue.updateMany(args),
      );
      if (!claimedAt) continue;

      const lease = {
        claimedAt,
        taskType: t.taskType,
        scheduledAt: t.scheduledAt,
        retryCount: t.retryCount,
      };
      const outcome = await dispatchVideoQueueItem(t, {
        lease,
        deadlineAt,
        updateQueueItem: async (id, data, workerLease) => {
          const result = await (prisma as any).processingQueue.updateMany({
            where: {
              id,
              status: "running",
              taskType: workerLease.taskType,
              retryCount: workerLease.retryCount,
              scheduledAt: { equals: workerLease.scheduledAt },
              updatedAt: workerLease.claimedAt,
            },
            data,
          });
          return result.count === 1;
        },
        processSora2VideoWatermarkRemoval: (task) =>
          taskProcessor.processSora2VideoWatermarkRemoval(task, deadlineAt),
      });
      if (outcome === "completed") processed++;
    }

    // 2. 同步 RunningHub 任务状态 - 优化版本
    const nowMs = Date.now();
    const syncThreshold = 10 * 1000; // 10秒后开始同步，更激进

    // 同步背景去除任务 - 包括所有非最终状态和成功但缺少结果的任务
    const backgroundTasks =
      Date.now() < hardDeadline
        ? await prisma.backgroundRemovalTask.findMany({
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
          })
        : [];

    for (const task of backgroundTasks) {
      if (Date.now() >= hardDeadline) break;
      try {
        if (!task.replicateId) continue;

        console.log(`🔄 同步背景去除任务: ${task.replicateId}`);

        // 查询 Replicate 状态
        const statusResp = await runninghubAPI.getTaskStatus(task.replicateId, {
          deadlineAt: hardDeadline,
        });
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
          const result = await runninghubAPI.getTaskResult(task.replicateId, {
            deadlineAt: hardDeadline,
          });

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
    const watermarkTasks =
      Date.now() < hardDeadline
        ? await prisma.watermarkRemovalTask.findMany({
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
          })
        : [];

    for (const task of watermarkTasks) {
      if (Date.now() >= hardDeadline) break;
      try {
        if (!task.runninghubTaskId) continue;

        console.log(`🔄 同步去水印任务: ${task.runninghubTaskId}`);

        // 查询 RunningHub 状态
        const statusResp = await runninghubAPI.getTaskStatus(
          task.runninghubTaskId,
          { deadlineAt: hardDeadline },
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
            { deadlineAt: hardDeadline },
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
      recovered,
      message: `Processed ${processed} queue tasks, recovered ${recovered} stale queue leases, synced ${synced} RunningHub tasks`,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("❌ Cron job error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

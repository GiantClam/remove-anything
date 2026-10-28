import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/db/prisma";
import { findSora2VideoWatermarkRemovalTaskByRunningHubId } from "@/db/queries/sora2-video-watermark-removal";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import { getErrorMessage } from "@/lib/handle-error";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { persistRunningHubOutput } from "@/lib/runninghub-output";
import { normalizeTaskStatus } from "@/lib/task-lifecycle";
import { runninghubAPI } from "@/modules/runninghub";

export const dynamic = "force-dynamic";

const RETRYABLE_RESULT_ERROR = "结果暂不可用，请稍后重试";
const IN_PROGRESS_STATUSES = new Set([
  "pending",
  "starting",
  "processing",
  "queued",
  "running",
]);

function protectedVideoPreview(
  taskId: string,
  status: unknown,
  imageUrl: string | null | undefined,
) {
  return normalizeTaskStatus(status) === "succeeded" &&
    getR2ObjectKey(imageUrl, env.R2_URL_BASE)
    ? `/api/download?${new URLSearchParams({
        type: "sora2-video-watermark-removal",
        taskId,
        preview: "1",
      })}`
    : null;
}

function visibleVideoStatus(
  status: unknown,
  imageUrl: string | null | undefined,
) {
  const normalized = normalizeTaskStatus(status);
  return normalized === "succeeded" &&
    !getR2ObjectKey(imageUrl, env.R2_URL_BASE)
    ? "processing"
    : normalized;
}

function providerStatus(data: unknown) {
  if (typeof data === "string") return data.toLowerCase();
  if (data && typeof data === "object" && "status" in data) {
    const status = (data as { status?: unknown }).status;
    return typeof status === "string" ? status.toLowerCase() : null;
  }
  return null;
}

function getProviderOutput(result: any) {
  const first = Array.isArray(result?.data) ? result.data[0] : null;
  return typeof first?.fileUrl === "string" && first.fileUrl.trim()
    ? first.fileUrl.trim()
    : null;
}

async function fetchAndPersistProviderOutput(taskId: string, recordId: number) {
  try {
    const result = await runninghubAPI.getTaskResult(taskId);
    if (result.code === 804 && result.msg === "APIKEY_TASK_IS_RUNNING") {
      return { url: null as string | null, unavailable: false };
    }

    const outputUrl = getProviderOutput(result);
    if (!outputUrl) return { url: null as string | null, unavailable: true };

    try {
      return {
        url: await persistRunningHubOutput(outputUrl, "video", recordId),
        unavailable: false,
      };
    } catch {
      return { url: null as string | null, unavailable: true };
    }
  } catch {
    return { url: null as string | null, unavailable: true };
  }
}

function responseFor(taskId: string, record: Record<string, any>) {
  const status = record.taskStatus;
  const imageUrl = record.imageUrl;
  const visibleStatus = visibleVideoStatus(status, imageUrl);
  return NextResponse.json({
    success: true,
    id: record.id,
    runninghubTaskId: taskId,
    taskStatus: visibleStatus,
    inputImageUrl: null,
    imageUrl: protectedVideoPreview(taskId, status, imageUrl),
    errorMsg: record.errorMsg,
    createdAt: record.createdAt,
    executeStartTime: record.executeStartTime?.toString(),
    executeEndTime: record.executeEndTime?.toString(),
  });
}

async function writeTaskResult(
  record: Record<string, any>,
  updateData: Record<string, unknown>,
) {
  const result = await prisma.taskData.updateMany({
    where: {
      id: record.id,
      taskStatus: { notIn: ["failed", "expired", "canceled", "cancelled"] },
      OR: [
        { imageUrl: record.imageUrl ?? null },
        {
          NOT: {
            imageUrl: { startsWith: `${env.R2_URL_BASE.replace(/\/$/, "")}/` },
          },
        },
      ],
    },
    data: updateData,
  });
  return result.count;
}

async function readLatest(taskId: string, fallback: Record<string, any>) {
  return (
    (await findSora2VideoWatermarkRemovalTaskByRunningHubId(taskId)) ?? fallback
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const taskId = params.id;
    const { searchParams } = new URL(req.url);
    const dbOnly = searchParams.get("dbOnly") === "true";

    if (!taskId)
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );

    const taskRecord =
      await findSora2VideoWatermarkRemovalTaskByRunningHubId(taskId);
    if (!taskRecord)
      return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (dbOnly) return responseFor(taskId, taskRecord);

    const normalizedStatus = normalizeTaskStatus(taskRecord.taskStatus);
    const isInProgress =
      IN_PROGRESS_STATUSES.has(String(taskRecord.taskStatus).toLowerCase()) ||
      normalizedStatus === "queued" ||
      normalizedStatus === "processing";
    const needsMigration =
      normalizedStatus === "succeeded" &&
      !getR2ObjectKey(taskRecord.imageUrl, env.R2_URL_BASE);

    if (!isInProgress && !needsMigration)
      return responseFor(taskId, taskRecord);

    let updateData: Record<string, unknown> = {};

    if (needsMigration) {
      if (taskRecord.imageUrl) {
        try {
          const persistedUrl = await persistRunningHubOutput(
            taskRecord.imageUrl,
            "video",
            taskRecord.id,
          );
          updateData = {
            taskStatus: "succeeded",
            imageUrl: persistedUrl,
            executeEndTime: taskRecord.executeEndTime ?? BigInt(Date.now()),
            errorMsg: null,
          };
        } catch {
          // A legacy provider URL may have expired. Refresh it below without
          // creating or replaying a provider task.
        }
      }

      if (!Object.keys(updateData).length) {
        const refreshed = await fetchAndPersistProviderOutput(
          taskId,
          taskRecord.id,
        );
        updateData = refreshed.url
          ? {
              taskStatus: "succeeded",
              imageUrl: refreshed.url,
              executeEndTime: BigInt(Date.now()),
              errorMsg: null,
            }
          : {
              taskStatus: "processing",
              executeEndTime: null,
              errorMsg: RETRYABLE_RESULT_ERROR,
            };
      }
    } else if (isInProgress) {
      try {
        const statusResult = await runninghubAPI.getTaskStatus(taskId);
        const status = providerStatus(statusResult.data);

        if (
          status === "succeeded" ||
          status === "success" ||
          status === "running"
        ) {
          const refreshed = await fetchAndPersistProviderOutput(
            taskId,
            taskRecord.id,
          );
          updateData = refreshed.url
            ? {
                taskStatus: "succeeded",
                imageUrl: refreshed.url,
                executeEndTime: BigInt(Date.now()),
                errorMsg: null,
              }
            : {
                taskStatus: "processing",
                ...(refreshed.unavailable
                  ? { executeEndTime: null, errorMsg: RETRYABLE_RESULT_ERROR }
                  : {}),
              };
        } else if (
          ["failed", "expired", "timeout", "timed_out"].includes(status ?? "")
        ) {
          updateData = {
            taskStatus: status === "failed" ? "failed" : "expired",
            executeEndTime: BigInt(Date.now()),
            errorMsg:
              (statusResult.data as any)?.error ??
              (status === "failed" ? "Task failed" : "Task expired"),
          };
        } else if (
          ["pending", "queued", "starting", "processing"].includes(status ?? "")
        ) {
          updateData = {
            taskStatus:
              status === "pending" ||
              status === "queued" ||
              status === "starting"
                ? "starting"
                : "processing",
          };
        }
      } catch {
        // Keep the current database state when the provider is temporarily
        // unavailable. A later poll can retry safely.
      }
    }

    if (Object.keys(updateData).length) {
      if (shouldSkipDatabaseQuery())
        return responseFor(taskId, { ...taskRecord, ...updateData });
      try {
        const count = await writeTaskResult(taskRecord, updateData);
        if (count === 0) {
          const latest = await readLatest(taskId, taskRecord);
          return responseFor(taskId, latest);
        }
        return responseFor(taskId, { ...taskRecord, ...updateData });
      } catch (dbError) {
        console.error(
          "❌ Sora2 task status compare-and-set failed:",
          getErrorMessage(dbError),
        );
        const latest = await readLatest(taskId, taskRecord);
        return responseFor(taskId, latest);
      }
    }

    return responseFor(taskId, taskRecord);
  } catch (error) {
    console.error("❌ 查询Sora2视频去水印任务状态失败:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

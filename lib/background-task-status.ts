import "server-only";

import type { BackgroundRemovalTask } from "@prisma/client";

import { prisma } from "@/db/prisma";
import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";
import { env } from "@/env.mjs";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { persistRunningHubOutput } from "@/lib/runninghub-output";
import { isTaskExpired, normalizeTaskStatus } from "@/lib/task-lifecycle";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import { runninghubAPI } from "@/modules/runninghub";

export function getBackgroundTaskPreviewUrl(taskId: string) {
  return `/api/download-background?${new URLSearchParams({ taskId, preview: "1" })}`;
}

/** Unknown provider responses must remain recoverable, never become failures. */
export function getRunningHubLifecycleStatus(value: unknown) {
  const status = String(value || "").toLowerCase();
  if (
    ["submitted", "queued", "pending", "starting", "waiting"].includes(status)
  )
    return "queued" as const;
  if (
    [
      "executing",
      "processing",
      "running",
      "in_progress",
      "in-progress",
    ].includes(status)
  )
    return "processing" as const;
  if (
    ["succeeded", "success", "completed", "complete", "done"].includes(status)
  )
    return "succeeded" as const;
  if (["expired", "timeout", "timed_out"].includes(status))
    return "expired" as const;
  if (["failed", "error", "canceled", "cancelled"].includes(status))
    return "failed" as const;
  throw new Error("Provider task status is unavailable");
}

/** Success requires a persisted result beneath the configured R2 prefix. */
export function getBackgroundTaskStatus(task: BackgroundRemovalTask) {
  const status = normalizeTaskStatus(task.taskStatus);
  return status === "succeeded" &&
    !getR2ObjectKey(task.outputImageUrl, env.R2_URL_BASE)
    ? "processing"
    : status;
}

export function getBackgroundProcessingDeadline(task: BackgroundRemovalTask) {
  const timeoutMs =
    getToolRegistryEntry("remove-background")!.limits.timeoutSeconds * 1000;
  return task.createdAt.getTime() + timeoutMs;
}

/** Refresh existing provider work without creating or replaying a job. */
export async function refreshBackgroundTaskStatus(
  task: BackgroundRemovalTask,
  isActive: () => boolean = () => true,
) {
  const currentStatus = getBackgroundTaskStatus(task);
  if (
    !["queued", "processing"].includes(currentStatus) ||
    isTaskExpired(task) ||
    !isActive()
  )
    return task;
  const repairingSuccess = normalizeTaskStatus(task.taskStatus) === "succeeded";
  const timedOut = () =>
    !repairingSuccess && Date.now() >= getBackgroundProcessingDeadline(task);
  const data: {
    taskStatus: string;
    outputImageUrl?: string;
    errorMsg?: string | null;
    executeStartTime?: bigint;
    executeEndTime?: bigint;
  } = { taskStatus: "processing" };

  if (timedOut()) {
    data.taskStatus = "failed";
    data.errorMsg = "Processing timed out. Please retry.";
    data.executeEndTime = BigInt(Date.now());
  } else {
    let output = repairingSuccess ? task.outputImageUrl : null;
    if (!output) {
      const response = await runninghubAPI.getTaskStatus(task.replicateId);
      const rawStatus =
        typeof response.data === "string"
          ? response.data
          : response.data?.status;
      if (response.code !== 0)
        throw new Error("Provider task status is unavailable");
      const status = getRunningHubLifecycleStatus(rawStatus);
      // A late queued response cannot regress an already-processing task.
      data.taskStatus =
        status === "queued" && currentStatus === "processing"
          ? "processing"
          : status;
      if (status === "succeeded" && !timedOut()) {
        const result = await runninghubAPI.getTaskResult(task.replicateId);
        output =
          result.code === 0 && Array.isArray(result.data)
            ? result.data
                .find(
                  (file) =>
                    typeof file?.fileUrl === "string" && file.fileUrl.trim(),
                )
                ?.fileUrl.trim()
            : null;
        if (!output) {
          data.taskStatus = "processing";
          data.errorMsg =
            "The provider result is not ready. Please retry shortly.";
        }
      } else if (status === "failed" || status === "expired") {
        data.errorMsg =
          typeof response.data === "object" && response.data?.error
            ? String(response.data.error)
            : status === "expired"
              ? "Task has expired"
              : "Task failed on provider";
        data.executeEndTime = BigInt(Date.now());
      } else {
        data.errorMsg = null;
        if (status === "processing" && !task.executeStartTime)
          data.executeStartTime = BigInt(Date.now());
      }
    }
    if (!isActive() || isTaskExpired(task)) return task;
    if (output && !timedOut()) {
      // Direct provider URLs, including historical successful records, remain
      // processing until their bytes have been migrated into private storage.
      data.outputImageUrl = getR2ObjectKey(output, env.R2_URL_BASE)
        ? output
        : await persistRunningHubOutput(output, "background", task.id);
      if (!getR2ObjectKey(data.outputImageUrl, env.R2_URL_BASE))
        throw new Error("Private result persistence failed");
      data.taskStatus = "succeeded";
      data.errorMsg = null;
      data.executeEndTime = BigInt(Date.now());
    }
    if (timedOut()) {
      delete data.outputImageUrl;
      data.taskStatus = "failed";
      data.errorMsg = "Processing timed out. Please retry.";
      data.executeEndTime = BigInt(Date.now());
    }
  }

  if (isActive() && !isTaskExpired(task)) {
    // Include both output and expiry: polling cannot overwrite a callback,
    // same-status output repair, or a changed retention deadline.
    await prisma.backgroundRemovalTask.updateMany({
      where: {
        id: task.id,
        taskStatus: task.taskStatus,
        outputImageUrl: task.outputImageUrl,
        expiresAt: task.expiresAt,
      },
      data,
    });
  }
  const persisted = await findBackgroundRemovalTaskByReplicateId(
    task.replicateId,
  );
  if (!persisted) throw new Error("Task no longer exists");
  return persisted;
}

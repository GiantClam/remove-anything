import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/db/prisma";
import { findWatermarkRemovalTaskByRunningHubId } from "@/db/queries/watermark-removal";
import { env } from "@/env.mjs";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { persistRunningHubOutput } from "@/lib/runninghub-output";
import {
  assertTaskOwnership,
  getTaskPrincipalFromRequest,
  normalizeTaskStatus,
  TaskLifecycleError,
} from "@/lib/task-lifecycle";
import { runninghubAPI } from "@/modules/runninghub";

export const dynamic = "force-dynamic";

function usableStatus(task: {
  taskStatus: string;
  outputZipUrl: string | null;
}) {
  const status = normalizeTaskStatus(task.taskStatus);
  return status === "succeeded" &&
    !getR2ObjectKey(task.outputZipUrl, env.R2_URL_BASE)
    ? "processing"
    : status;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const taskId = params.id;
    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    }

    let task = await findWatermarkRemovalTaskByRunningHubId(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const user = await getCurrentUser();
    const principal = getTaskPrincipalFromRequest(req, user?.id);
    try {
      assertTaskOwnership(task, principal);
    } catch (error) {
      if (error instanceof TaskLifecycleError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }
      throw error;
    }

    let taskStatus = usableStatus(task);

    const dbOnly = new URL(req.url).searchParams.get("dbOnly") === "true";
    if (!dbOnly && ["queued", "processing"].includes(taskStatus)) {
      try {
        // Repair old raw provider outputs without creating new provider work.
        const legacyOutput =
          normalizeTaskStatus(task.taskStatus) === "succeeded"
            ? task.outputZipUrl
            : null;
        const statusResult = legacyOutput
          ? { code: 0, data: { status: "succeeded", error: undefined } }
          : await runninghubAPI.getTaskStatus(taskId);
        const rawStatus =
          typeof statusResult.data === "string"
            ? statusResult.data
            : statusResult.data?.status;
        if (statusResult.code !== 0 || !rawStatus) {
          throw new Error("Provider task status is unavailable");
        }
        const providerStatus = normalizeTaskStatus(rawStatus);
        let nextStatus = providerStatus;
        let nextOutput = task.outputZipUrl;
        let nextError = task.errorMsg;
        let nextStart = task.executeStartTime;
        let nextEnd = task.executeEndTime;

        if (providerStatus === "succeeded") {
          try {
            const result = legacyOutput
              ? null
              : await runninghubAPI.getTaskResult(taskId);
            const output =
              legacyOutput ||
              (result?.code === 0 && Array.isArray(result.data)
                ? result.data.find(
                    (file) =>
                      typeof file?.fileUrl === "string" && file.fileUrl.trim(),
                  )?.fileUrl
                : undefined);
            if (output) {
              nextOutput = await persistRunningHubOutput(
                output.trim(),
                "watermark",
                task.id,
              );
              if (!getR2ObjectKey(nextOutput, env.R2_URL_BASE))
                throw new Error("Private result storage is unavailable");
              nextError = "";
              nextEnd = BigInt(Date.now());
            } else {
              nextStatus = "processing";
              nextEnd = null;
              nextError =
                "The provider result is not available yet. Please retry shortly.";
            }
          } catch (error) {
            nextStatus = "processing";
            nextOutput = task.outputZipUrl;
            nextEnd = null;
            nextError =
              "The result could not be stored yet. Please retry shortly.";
            console.warn("Watermark result could not be persisted");
          }
        } else if (providerStatus === "processing") {
          nextStart = task.executeStartTime || BigInt(Date.now());
          nextError = null;
        } else if (
          providerStatus === "failed" ||
          providerStatus === "expired"
        ) {
          nextEnd = BigInt(Date.now());
          nextError =
            typeof statusResult.data?.error === "string"
              ? statusResult.data.error
              : "Watermark removal failed. Please retry.";
        }

        // The exact state read before the provider request is a CAS guard.
        // A slow poll cannot overwrite a webhook's newer terminal result.
        assertTaskOwnership(task, principal);
        await prisma.watermarkRemovalTask.updateMany({
          where: {
            id: task.id,
            taskStatus: task.taskStatus,
            outputZipUrl: task.outputZipUrl,
            expiresAt: task.expiresAt,
          },
          data: {
            taskStatus: nextStatus,
            ...(nextOutput ? { outputZipUrl: nextOutput } : {}),
            errorMsg: nextError,
            ...(nextStart != null ? { executeStartTime: nextStart } : {}),
            executeEndTime: nextEnd,
          },
        });
      } catch (error) {
        console.warn("Watermark task status could not be refreshed", error);
      }

      // A webhook may have won the race even when polling failed. Report
      // persisted state and re-check authorization/expiry after the await.
      task = await findWatermarkRemovalTaskByRunningHubId(taskId);
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      assertTaskOwnership(task, principal);
      taskStatus = usableStatus(task);
    }

    return NextResponse.json(
      {
        success: true,
        id: task.id,
        runninghubTaskId: taskId,
        taskStatus,
        // Download authorization and expiry remain enforced on every read.
        // Keeping raw storage/provider URLs server-side avoids untracked copies.
        outputZipUrl:
          taskStatus === "succeeded" && task.outputZipUrl
            ? `/api/download?type=watermark-removal&taskId=${encodeURIComponent(taskId)}`
            : undefined,
        errorMsg: task.errorMsg,
        createdAt: task.createdAt,
        executeStartTime: task.executeStartTime?.toString(),
        executeEndTime: task.executeEndTime?.toString(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie, Authorization",
        },
      },
    );
  } catch (error) {
    if (error instanceof TaskLifecycleError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("Watermark task status failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

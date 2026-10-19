import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/db/prisma";
import { findObjectRemovalTaskByRunningHubId } from "@/db/queries/object-removal";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import {
  isR2PublicUrl,
  saveObjectRemovalImageToR2,
} from "@/lib/remove-objects/output-image";
import { getRunningHubOutputFileUrl } from "@/lib/remove-objects/runninghub";
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
  outputImageUrl: string | null;
}) {
  const status = normalizeTaskStatus(task.taskStatus);
  return status === "succeeded" && !isR2PublicUrl(task.outputImageUrl)
    ? "processing"
    : status;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const taskId = params.id;
    if (!taskId)
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 },
      );
    let task = await findObjectRemovalTaskByRunningHubId(taskId);
    if (!task)
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const user = await getCurrentUser();
    const principal = getTaskPrincipalFromRequest(req, user?.id);
    assertTaskOwnership(task, principal);

    let taskStatus = usableStatus(task);
    const dbOnly = new URL(req.url).searchParams.get("dbOnly") === "true";
    if (!dbOnly && ["queued", "processing"].includes(taskStatus)) {
      try {
        let nextStatus = taskStatus;
        let nextOutput: string | undefined;
        let nextError: string | null = null;
        let nextStart = task.executeStartTime;
        let nextEnd = task.executeEndTime;
        // Repair previously published provider URLs without creating new work.
        const legacyOutput =
          normalizeTaskStatus(task.taskStatus) === "succeeded"
            ? task.outputImageUrl
            : null;
        let providerStatus: ReturnType<typeof normalizeTaskStatus> =
          "succeeded";
        if (!legacyOutput) {
          const response = await runninghubAPI.getTaskStatus(taskId);
          const rawStatus =
            typeof response.data === "string"
              ? response.data
              : response.data?.status;
          if (response.code !== 0 || !rawStatus)
            throw new Error("Provider task status is unavailable");
          const providerState = rawStatus.toLowerCase();
          providerStatus = normalizeTaskStatus(
            providerState === "submitted"
              ? "queued"
              : providerState === "executing"
                ? "processing"
                : providerState,
          );
          nextStatus = providerStatus;
          if (["failed", "expired"].includes(providerStatus)) {
            nextError =
              typeof response.data === "object" &&
              typeof response.data?.error === "string"
                ? response.data.error
                : "Object removal failed. Please retry.";
            nextEnd = BigInt(Date.now());
          }
        }

        if (providerStatus === "succeeded") {
          try {
            let output = legacyOutput;
            if (!output) {
              const result = await runninghubAPI.getTaskResult(taskId);
              output =
                result.code === 0
                  ? getRunningHubOutputFileUrl(result.data)?.trim() || null
                  : null;
            }
            if (!output) {
              nextStatus = "processing";
              nextEnd = null;
              nextError =
                "The provider result is not available yet. Please retry shortly.";
            } else {
              nextOutput = await saveObjectRemovalImageToR2(
                output,
                taskId,
                task.id,
              );
              if (!isR2PublicUrl(nextOutput))
                throw new Error("Private result storage is unavailable");
              nextStatus = "succeeded";
              nextEnd = BigInt(Date.now());
            }
          } catch (error) {
            nextStatus = "processing";
            nextOutput = undefined;
            nextEnd = null;
            nextError =
              "The result could not be stored yet. Please retry shortly.";
            console.warn("Object result could not be persisted", error);
          }
        } else if (providerStatus === "processing") {
          nextStart = task.executeStartTime || BigInt(Date.now());
        }

        // The original deadline may elapse while provider/storage work awaits.
        assertTaskOwnership(task, principal);
        // Match the exact snapshot read before polling, including its deadline,
        // so callbacks or early deletion cannot be replaced by a slow poll.
        await prisma.objectRemovalTask.updateMany({
          where: {
            id: task.id,
            taskStatus: task.taskStatus,
            outputImageUrl: task.outputImageUrl,
            expiresAt: task.expiresAt,
          },
          data: {
            taskStatus: nextStatus,
            ...(nextOutput ? { outputImageUrl: nextOutput } : {}),
            errorMsg: nextError,
            ...(nextStart != null ? { executeStartTime: nextStart } : {}),
            executeEndTime: nextEnd,
          },
        });
      } catch (error) {
        console.warn("Object task status could not be refreshed", error);
      }

      task = await findObjectRemovalTaskByRunningHubId(taskId);
      if (!task)
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      assertTaskOwnership(task, principal);
      taskStatus = usableStatus(task);
    }

    return NextResponse.json(
      {
        success: true,
        taskStatus,
        outputImageUrl:
          taskStatus === "succeeded"
            ? `/api/download-object?taskId=${encodeURIComponent(taskId)}&preview=1`
            : undefined,
        errorMsg: task.errorMsg,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie, Authorization",
        },
      },
    );
  } catch (error) {
    if (error instanceof TaskLifecycleError)
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

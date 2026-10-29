import { NextResponse, type NextRequest } from "next/server";

import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";
import { getCurrentUser } from "@/lib/auth-utils";
import {
  getBackgroundTaskPreviewUrl,
  getBackgroundTaskStatus,
  refreshBackgroundTaskStatus,
} from "@/lib/background-task-status";
import { getErrorMessage } from "@/lib/handle-error";
import {
  assertTaskOwnership,
  getTaskPrincipalFromRequest,
  TaskLifecycleError,
} from "@/lib/task-lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const taskId = params.id;
    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400, headers: responseHeaders },
      );
    }

    const user = await getCurrentUser();
    const principal = getTaskPrincipalFromRequest(req, user?.id);
    let task;
    try {
      task = await findBackgroundRemovalTaskByReplicateId(taskId);
    } catch {
      return NextResponse.json(
        {
          error: "Task ownership could not be verified",
          code: "TASK_AUTH_UNAVAILABLE",
        },
        { status: 503, headers: responseHeaders },
      );
    }
    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404, headers: responseHeaders },
      );
    }
    assertTaskOwnership(task, principal);

    let degraded = false;
    if (new URL(req.url).searchParams.get("dbOnly") !== "true") {
      try {
        task = await refreshBackgroundTaskStatus(task);
      } catch (error) {
        console.error("Background task provider refresh failed:", error);
        degraded = true;
      }
    }
    assertTaskOwnership(task, principal);

    const status = getBackgroundTaskStatus(task);
    const output =
      status === "succeeded" ? getBackgroundTaskPreviewUrl(taskId) : null;
    return NextResponse.json(
      {
        success: true,
        taskId,
        id: taskId,
        status,
        taskStatus: status,
        dbTaskStatus: status,
        output,
        outputImageUrl: output,
        imageUrl: output,
        error: task.errorMsg,
        taskRecordId: task.id,
        inputImageUrl: task.inputImageUrl,
        createdAt: task.createdAt,
        executeStartTime: task.executeStartTime?.toString(),
        executeEndTime: task.executeEndTime?.toString(),
        ...(degraded ? { degraded: true } : {}),
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    if (error instanceof TaskLifecycleError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          status: error.code === "TASK_EXPIRED" ? "expired" : "failed",
        },
        { status: error.status, headers: responseHeaders },
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500, headers: responseHeaders },
    );
  }
}

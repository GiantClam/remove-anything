import { NextRequest, NextResponse } from "next/server";

import { findBackgroundRemovalTaskByReplicateId } from "@/db/queries/background-removal";
import { getCurrentUser } from "@/lib/auth-utils";
import {
  getBackgroundTaskPreviewUrl,
  getBackgroundTaskStatus,
  refreshBackgroundTaskStatus,
} from "@/lib/background-task-status";
import {
  assertTaskOwnership,
  getTaskPrincipalFromRequest,
  TaskLifecycleError,
} from "@/lib/task-lifecycle";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const taskId = params.taskId;
  if (!taskId) {
    return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const principal = getTaskPrincipalFromRequest(req, user?.id);
  if (!principal.userId && !principal.principalId) {
    return NextResponse.json(
      { error: "Not authenticated", code: "ANONYMOUS_PRINCIPAL_REQUIRED" },
      { status: 401 },
    );
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let stop = () => {
    closed = true;
    if (timer) clearTimeout(timer);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let attempts = 0;
      const maxAttempts = 120;
      const abort = () => close();
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        req.signal.removeEventListener("abort", abort);
      };
      const close = () => {
        if (closed) return;
        cleanup();
        controller.close();
      };
      stop = cleanup;
      req.signal.addEventListener("abort", abort, { once: true });

      const send = (data: Record<string, unknown>) => {
        if (!closed)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
      };
      const checkTaskStatus = async () => {
        if (closed) return;
        attempts++;
        try {
          let task = await findBackgroundRemovalTaskByReplicateId(taskId);
          if (!task) {
            send({
              taskId,
              status: "failed",
              code: "TASK_NOT_FOUND",
              error: "Task not found",
            });
            close();
            return;
          }
          assertTaskOwnership(task, principal);
          let degraded = false;
          try {
            task = await refreshBackgroundTaskStatus(task);
          } catch (error) {
            console.error("Background SSE provider refresh failed:", error);
            degraded = true;
          }
          assertTaskOwnership(task, principal);

          const status = getBackgroundTaskStatus(task);
          send({
            taskId,
            status,
            output:
              status === "succeeded"
                ? getBackgroundTaskPreviewUrl(taskId)
                : null,
            error: task.errorMsg,
            attempts,
            maxAttempts,
            ...(degraded ? { degraded: true } : {}),
          });
          if (["succeeded", "failed", "expired"].includes(status)) {
            close();
            return;
          }
          if (attempts >= maxAttempts) {
            send({
              taskId,
              status: "expired",
              code: "TASK_STATUS_TIMEOUT",
              error: "Task status check timed out",
            });
            close();
            return;
          }
        } catch (error) {
          const lifecycleError =
            error instanceof TaskLifecycleError ? error : null;
          send({
            taskId,
            status:
              lifecycleError?.code === "TASK_EXPIRED" ? "expired" : "failed",
            code: lifecycleError?.code || "TASK_QUERY_FAILED",
            error:
              lifecycleError?.message || "Task status could not be checked",
          });
          close();
          return;
        }
        // Schedule only after the previous provider check has completed.
        if (!closed) timer = setTimeout(checkTaskStatus, 3000);
      };

      if (req.signal.aborted) close();
      else void checkTaskStatus();
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie, Authorization",
      Connection: "keep-alive",
    },
  });
}

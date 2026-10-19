import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";
import { getErrorMessage } from "@/lib/handle-error";
import { logsnag } from "@/lib/log-snag";
import {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
  emitServerAnalyticsEvent,
} from "@/lib/analytics-events";
import { normalizeTaskStatus, refundFailedTaskCredit } from "@/lib/task-lifecycle";

const WebhookSchema = z.object({
  taskStatus: z.string().transform((value) => value.trim().toLowerCase()).refine(
    (value) => ["queued", "pending", "starting", "processing", "running", "succeeded", "success", "failed", "canceled", "cancelled", "expired", "timeout"].includes(value),
    "Unsupported task status",
  ),
  replicateId: z.string().min(1),
});

export async function POST(req: Request) {
  if (!env.TASK_HEADER_KEY) {
    return NextResponse.json({ error: "Task callback authentication is unavailable" }, { status: 503 });
  }
  if (req.headers.get("remove-anything-webhook-key") !== env.TASK_HEADER_KEY) {
    return NextResponse.json({ error: "Invalid task callback key" }, { status: 400 });
  }

  try {
    const { replicateId, taskStatus } = WebhookSchema.parse(await req.json());
    const task = await prisma.taskData.findFirst({ where: { replicateId } });
    if (!task) return NextResponse.json({ error: "Task data not found" }, { status: 404 });

    const status = normalizeTaskStatus(taskStatus);
    const previousStatus = normalizeTaskStatus(task.taskStatus);
    const terminal = ["succeeded", "failed", "expired"].includes(previousStatus);
    if ((terminal && previousStatus !== status) || (previousStatus === "processing" && status === "queued")) {
      return NextResponse.json({ success: true, message: "Newer task state already recorded" });
    }

    let transitioned = false;
    if (task.taskStatus !== status) {
      const result = await prisma.taskData.updateMany({
        where: { id: task.id, taskStatus: task.taskStatus },
        data: {
          taskStatus: status,
          ...(["succeeded", "failed", "expired"].includes(status) ? { executeEndTime: BigInt(Date.now()) } : {}),
        },
      });
      transitioned = result.count > 0 && previousStatus !== status;
    }

    if (transitioned) {
      const eventName = status === "succeeded"
        ? ANALYTICS_EVENTS.taskSucceeded
        : status === "failed" || status === "expired"
          ? ANALYTICS_EVENTS.taskFailed
          : status === "processing" ? ANALYTICS_EVENTS.taskProcessing : ANALYTICS_EVENTS.taskCreated;
      await emitServerAnalyticsEvent(createTaskAnalyticsEvent(eventName, task.id, {
        is_authenticated: Boolean(task.userId),
        locale: task.locale ?? undefined,
      }));
    }

    // The refund helper rechecks the persisted failure and claims its real
    // withdrawal. Success, processing, and free tasks cannot receive credits.
    if (status === "failed" && task.userId) {
      const refunded = await refundFailedTaskCredit(task.userId, task.id, "image");
      if (refunded) {
        await logsnag.track({
          channel: "refund",
          event: "Refund points",
          user_id: task.userId,
          description: "Task failed; its consumed credits were returned",
          icon: "💰",
        }).catch((error: unknown) => console.warn("Refund notification failed:", error));
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

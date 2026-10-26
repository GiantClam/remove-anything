import { NextResponse } from "next/server";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";
import {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "@/lib/analytics-events";
import { emitServerAnalyticsEvent } from "@/lib/server-analytics-events";
import {
  readLimitedResponse,
  ResultSizeLimitError,
} from "@/lib/limited-response";
import { getRunningHubOutputFileUrl } from "@/lib/remove-objects/runninghub";
import {
  isAllowedRunningHubOutput,
  persistRunningHubOutput,
} from "@/lib/runninghub-output";
import { taskQueueManager } from "@/lib/task-queue";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  event: z.string(),
  taskId: z.string().min(1).max(200),
  eventData: z.string().max(60_000),
});
const EventSchema = z.object({
  code: z.number().int(),
  data: z.unknown().optional(),
});

function terminal(status: string) {
  return [
    "success",
    "succeeded",
    "failed",
    "error",
    "expired",
    "timeout",
    "canceled",
    "cancelled",
  ].includes(status.toLowerCase());
}

export async function POST(req: Request) {
  const secret = env.RUNNINGHUB_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { error: "RunningHub callback authentication is unavailable" },
      { status: 503 },
    );
  }
  const provided =
    req.headers.get("remove-anything-webhook-key") ||
    new URL(req.url).searchParams.get("key");
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided || "");
  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    return NextResponse.json(
      { error: "Invalid callback key" },
      { status: 401 },
    );
  }

  try {
    // Authenticate before reading a body, looking up a task, or fetching output.
    const bytes = await readLimitedResponse(
      new Response(req.body, { headers: req.headers }),
      64 * 1024,
    );
    const { event, taskId, eventData } = BodySchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    if (event !== "TASK_END")
      return NextResponse.json({ success: true, message: "Ignored event" });
    const { code, data } = EventSchema.parse(JSON.parse(eventData));

    let watermark = await prisma.watermarkRemovalTask.findUnique({
      where: { runninghubTaskId: taskId },
    });
    let object = watermark
      ? null
      : await prisma.objectRemovalTask.findUnique({
          where: { runninghubTaskId: taskId },
        });
    let video =
      watermark || object
        ? null
        : await prisma.taskData.findFirst({
            where: {
              replicateId: taskId,
              model: "sora2-video-watermark-removal",
            },
          });
    let attachVideoTaskId = false;
    let attachImageTaskId = false;
    if (!watermark && !object && !video) {
      // A provider may have accepted a task even when the create response was
      // lost or the local taskId write failed. The authenticated callback URL
      // carries the pre-created record id so we can recover that one row.
      const callbackUrl = new URL(req.url);
      const recordId = Number(callbackUrl.searchParams.get("recordId"));
      const recordType = callbackUrl.searchParams.get("recordType");
      if (Number.isSafeInteger(recordId) && recordId > 0) {
        if (recordType === "watermark") {
          const candidate = await prisma.watermarkRemovalTask.findUnique({
            where: { id: recordId },
          });
          if (candidate?.runninghubTaskId == null) {
            watermark = candidate;
            attachImageTaskId = Boolean(candidate);
          }
        } else if (recordType === "object") {
          const candidate = await prisma.objectRemovalTask.findUnique({
            where: { id: recordId },
          });
          if (candidate?.runninghubTaskId == null) {
            object = candidate;
            attachImageTaskId = Boolean(candidate);
          }
        } else if (recordType === "video") {
          video = await prisma.taskData.findFirst({
            where: {
              id: recordId,
              model: "sora2-video-watermark-removal",
              replicateId: null,
            },
          });
          attachVideoTaskId = Boolean(video);
        }
      }
    }
    const task = watermark || object || video;
    if (!task)
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const deadline =
      task.expiresAt ||
      new Date(task.createdAt.getTime() + 24 * 60 * 60 * 1000);
    // Terminal records and retention deadlines are immutable to late callbacks.
    if (terminal(task.taskStatus) || deadline.getTime() <= Date.now()) {
      return NextResponse.json({
        success: true,
        message: "Newer task state already recorded",
      });
    }

    let output: string | null = null;
    if (code === 0) {
      const source = getRunningHubOutputFileUrl(data);
      if (!source)
        return NextResponse.json(
          { error: "Provider result is not ready; poll the original task" },
          { status: 503 },
        );
      if (!isAllowedRunningHubOutput(source))
        return NextResponse.json(
          {
            error:
              "Provider output source is not approved; poll the original task",
          },
          { status: 503 },
        );
      // Migrate every successful provider result into private R2. Provider
      // URLs are ephemeral and must never become durable download metadata.
      output = await persistRunningHubOutput(
        source,
        video ? "video" : object ? "object" : "watermark",
        task.id,
      );
    }
    if (deadline.getTime() <= Date.now())
      return NextResponse.json({ success: true, message: "Task has expired" });

    const taskStatus = code === 0 ? "succeeded" : "failed";
    const update = {
      taskStatus,
      executeEndTime: BigInt(Date.now()),
      errorMsg: code === 0 ? null : "Provider task failed",
    };
    // Include the original output as well as state: a polling repair can fill
    // output without changing state while this callback is awaiting a fetch.
    const result = watermark
      ? await prisma.watermarkRemovalTask.updateMany({
          where: {
            id: watermark.id,
            runninghubTaskId: watermark.runninghubTaskId,
            taskStatus: watermark.taskStatus,
            outputZipUrl: watermark.outputZipUrl,
            expiresAt: watermark.expiresAt,
          },
          data: {
            ...update,
            ...(attachImageTaskId ? { runninghubTaskId: taskId } : {}),
            ...(output ? { outputZipUrl: output } : {}),
          },
        })
      : object
        ? await prisma.objectRemovalTask.updateMany({
            where: {
              id: object.id,
              runninghubTaskId: object.runninghubTaskId,
              taskStatus: object.taskStatus,
              outputImageUrl: object.outputImageUrl,
              expiresAt: object.expiresAt,
            },
            data: {
              ...update,
              ...(attachImageTaskId ? { runninghubTaskId: taskId } : {}),
              ...(output ? { outputImageUrl: output } : {}),
            },
          })
        : await prisma.taskData.updateMany({
            where: {
              id: video!.id,
              replicateId: video!.replicateId,
              taskStatus: video!.taskStatus,
              imageUrl: video!.imageUrl,
              expiresAt: video!.expiresAt,
            },
            data: {
              ...update,
              ...(attachVideoTaskId ? { replicateId: taskId } : {}),
              ...(output ? { imageUrl: output } : {}),
            },
          });
    if (result.count > 0) {
      taskQueueManager.stopStatusWatcher(taskId);
      const eventName =
        taskStatus === "succeeded"
          ? ANALYTICS_EVENTS.processingCompleted
          : ANALYTICS_EVENTS.processingFailed;
      await emitServerAnalyticsEvent(
        createTaskAnalyticsEvent(eventName, task.id, {
          is_authenticated: Boolean(task.userId),
          locale: "locale" in task ? (task.locale ?? undefined) : undefined,
        }),
      );
    }
    return NextResponse.json({
      success: true,
      message:
        result.count > 0
          ? "Callback recorded"
          : "Newer task state already recorded",
    });
  } catch (error) {
    // Do not log the request URL/body, output URLs, or provider errors: the
    // callback URL carries a bearer secret and provider URLs may be signed.
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        { error: "Invalid callback payload" },
        { status: 400 },
      );
    if (error instanceof ResultSizeLimitError)
      return NextResponse.json(
        { error: "Callback or output exceeds the supported size" },
        { status: 413 },
      );
    console.warn(
      "RunningHub callback could not be recorded; task polling remains available",
    );
    return NextResponse.json(
      { error: "Callback could not be recorded; poll the original task" },
      { status: 503 },
    );
  }
}

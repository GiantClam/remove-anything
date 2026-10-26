import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { getErrorMessage } from "@/lib/handle-error";
import { ImageInputError } from "@/lib/image-input";
import {
  acquireProcessingLease,
  OBJECT_GEOMETRY_PROCESSING_KEY,
  ProcessingTimeoutError,
  runWithinProcessingDeadline,
  sleepUntilProcessingDeadline,
} from "@/lib/processing-guard";
import {
  buildSegmentNodeInfoList,
  getRunningHubOutputFileUrl,
  normalizeRunningHubStatus,
} from "@/lib/remove-objects/runninghub";
import { readRemoveObjectsImage } from "@/lib/remove-objects/input-image";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import { runninghubAPI } from "@/modules/runninghub";

const SegmentSchema = z.object({
  imageUrl: z.string().url(),
  bbox: z.object({
    x: z.number().finite().min(0),
    y: z.number().finite().min(0),
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
  }),
});

export const dynamic = "force-dynamic";

function isTransientRunningHubError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return (
    message.includes("status=504") ||
    message.includes("status=502") ||
    message.includes("status=503") ||
    message.includes("fetch failed") ||
    message.includes("APIKEY_TASK_IS_RUNNING")
  );
}

export async function POST(req: NextRequest) {
  let lease: ReturnType<typeof acquireProcessingLease> | null = null;
  let runninghubTaskId: string | null = null;
  let deadline = 0;
  try {
    const body = SegmentSchema.parse(await req.json());
    const tool = getToolRegistryEntry("remove-objects");
    if (!tool) {
      return NextResponse.json(
        { error: "Tool configuration unavailable", code: "TOOL_UNAVAILABLE" },
        { status: 503 },
      );
    }
    const imageOptions = {
      maxBytes: tool.limits.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: tool.inputFormats,
      maxPixels: tool.limits.maxPixels,
    };
    const input = await readRemoveObjectsImage(body.imageUrl, imageOptions);
    const image = input.image;
    if (
      body.bbox.x + body.bbox.w > image.width ||
      body.bbox.y + body.bbox.h > image.height
    ) {
      throw new ImageInputError(
        "BBOX_OUT_OF_BOUNDS",
        "The selected area must stay within the image dimensions",
        400,
      );
    }
    lease = acquireProcessingLease(OBJECT_GEOMETRY_PROCESSING_KEY);
    if (!lease) {
      return NextResponse.json(
        {
          error: "Object segmentation is busy. Please retry shortly.",
          code: "PROCESSING_CAPACITY_EXCEEDED",
        },
        { status: 429, headers: { "retry-after": "5" } },
      );
    }
    deadline = Date.now() + tool.limits.timeoutSeconds * 1000;
    runninghubTaskId = await runWithinProcessingDeadline(
      () =>
        runninghubAPI.createObjectSegmentTask(
          buildSegmentNodeInfoList(input.providerUrl, body.bbox),
          { deadlineAt: deadline },
        ),
      deadline,
    );

    while (Date.now() < deadline) {
      let statusResult;
      try {
        statusResult = await runWithinProcessingDeadline(
          () =>
            runninghubAPI.getTaskStatus(runninghubTaskId!, {
              deadlineAt: deadline,
            }),
          deadline,
        );
      } catch (error) {
        if (isTransientRunningHubError(error)) {
          if (!(await sleepUntilProcessingDeadline(deadline, 1500))) break;
          continue;
        }

        throw error;
      }

      const normalizedStatus = normalizeRunningHubStatus(statusResult.data);

      if (normalizedStatus === "failed") {
        return NextResponse.json(
          {
            error:
              statusResult.data?.error ||
              "AI could not refine the selected area",
          },
          { status: 422 },
        );
      }

      if (normalizedStatus === "succeeded") {
        let outputs;
        try {
          outputs = await runWithinProcessingDeadline(
            () =>
              runninghubAPI.getTaskResult(runninghubTaskId!, {
                deadlineAt: deadline,
              }),
            deadline,
          );
        } catch (error) {
          if (isTransientRunningHubError(error)) {
            if (!(await sleepUntilProcessingDeadline(deadline, 1500))) break;
            continue;
          }

          throw error;
        }
        const maskUrl = getRunningHubOutputFileUrl(outputs?.data);

        if (maskUrl) {
          return NextResponse.json({
            success: true,
            maskUrl,
          });
        }

        if (outputs?.code === 804) {
          if (!(await sleepUntilProcessingDeadline(deadline, 1500))) break;
          continue;
        }

        return NextResponse.json(
          { error: "Segment task completed without a mask output" },
          { status: 502 },
        );
      }

      if (!(await sleepUntilProcessingDeadline(deadline, 1500))) break;
    }

    if (runninghubTaskId)
      void runninghubAPI.cancelTask(runninghubTaskId).catch(() => null);

    return NextResponse.json(
      { error: "Segment request timed out before a mask was ready" },
      { status: 504 },
    );
  } catch (error) {
    if (error instanceof ProcessingTimeoutError) {
      if (runninghubTaskId)
        void runninghubAPI.cancelTask(runninghubTaskId).catch(() => null);
      return NextResponse.json(
        { error: "Segment request timed out before a mask was ready" },
        { status: 504 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid request" },
        { status: 400 },
      );
    }
    if (error instanceof ImageInputError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  } finally {
    lease?.release();
  }
}

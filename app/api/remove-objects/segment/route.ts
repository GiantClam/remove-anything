import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { getErrorMessage } from "@/lib/handle-error";
import { ImageInputError, readTrustedRemoteImage } from "@/lib/image-input";
import {
  buildSegmentNodeInfoList,
  getRunningHubOutputFileUrl,
  normalizeRunningHubStatus,
} from "@/lib/remove-objects/runninghub";
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  try {
    const body = SegmentSchema.parse(await req.json());
    const tool = getToolRegistryEntry("remove-objects");
    if (!tool) {
      return NextResponse.json(
        { error: "Tool configuration unavailable", code: "TOOL_UNAVAILABLE" },
        { status: 503 },
      );
    }
    const image = await readTrustedRemoteImage(body.imageUrl, {
      maxBytes: tool.limits.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: tool.inputFormats,
      maxPixels: tool.limits.maxPixels,
    });
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
    const taskId = await runninghubAPI.createObjectSegmentTask(
      buildSegmentNodeInfoList(body.imageUrl, body.bbox),
    );

    const startedAt = Date.now();
    while (Date.now() - startedAt < tool.limits.timeoutSeconds * 1000) {
      let statusResult;
      try {
        statusResult = await runninghubAPI.getTaskStatus(taskId);
      } catch (error) {
        if (isTransientRunningHubError(error)) {
          await sleep(1500);
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
          outputs = await runninghubAPI.getTaskResult(taskId);
        } catch (error) {
          if (isTransientRunningHubError(error)) {
            await sleep(1500);
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
          await sleep(1500);
          continue;
        }

        return NextResponse.json(
          { error: "Segment task completed without a mask output" },
          { status: 502 },
        );
      }

      await sleep(1500);
    }

    await runninghubAPI.cancelTask(taskId).catch(() => null);

    return NextResponse.json(
      { error: "Segment request timed out before a mask was ready" },
      { status: 504 },
    );
  } catch (error) {
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
  }
}

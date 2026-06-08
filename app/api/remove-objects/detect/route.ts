import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage } from "@/lib/handle-error";
import {
  buildDetectNodeInfoList,
  getRunningHubOutputFileUrl,
  normalizeRunningHubStatus,
} from "@/lib/remove-objects/runninghub";
import { runninghubAPI } from "@/modules/runninghub";

const DetectSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().trim().min(1).max(120),
});

export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRunningHubError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

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
    const body = DetectSchema.parse(await req.json());
    const taskId = await runninghubAPI.createObjectDetectTask(
      buildDetectNodeInfoList(body.imageUrl, body.prompt),
    );

    const startedAt = Date.now();
    while (Date.now() - startedAt < 20_000) {
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
          { error: statusResult.data?.error || "AI could not find a reliable object" },
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
            prompt: body.prompt,
            maskUrl,
          });
        }

        if (outputs?.code === 804) {
          await sleep(1500);
          continue;
        }

        return NextResponse.json(
          { error: "Detect task completed without a mask output" },
          { status: 502 },
        );
      }

      await sleep(1500);
    }

    await runninghubAPI.cancelTask(taskId).catch(() => null);

    return NextResponse.json(
      { error: "Detect request timed out before a mask was ready" },
      { status: 504 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

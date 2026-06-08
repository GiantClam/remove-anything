import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";

import { createObjectRemovalTask, updateObjectRemovalTask } from "@/db/queries/object-removal";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { buildRemoveNodeInfoList } from "@/lib/remove-objects/runninghub";
import { runninghubAPI } from "@/modules/runninghub";

const RemoveSchema = z.object({
  imageUrl: z.string().url(),
  maskUrl: z.string().url(),
  prompt: z.string().trim().max(120).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let placeholderTaskId: number | undefined;
  let runninghubTaskId: string | undefined;

  try {
    const body = RemoveSchema.parse(await req.json());
    const user = await getCurrentUser();
    const prompt = body.prompt || undefined;

    const placeholderTask = await createObjectRemovalTask({
      userId: user?.id || undefined,
      runninghubTaskId: `pending-${nanoid(10)}`,
      inputImageUrl: body.imageUrl,
      inputMaskUrl: body.maskUrl,
      detectPrompt: prompt,
    });

    placeholderTaskId = placeholderTask.id;

    runninghubTaskId = await runninghubAPI.createObjectRemoveTask(
      buildRemoveNodeInfoList(body.imageUrl, body.maskUrl, prompt),
      placeholderTask.id,
    );

    try {
      await updateObjectRemovalTask(placeholderTask.id, {
        runninghubTaskId,
        taskStatus: "processing",
        executeStartTime: BigInt(Date.now()),
        errorMsg: null,
      });
    } catch (updateError) {
      await runninghubAPI.cancelTask(runninghubTaskId).catch(() => null);
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      taskId: runninghubTaskId,
      recordId: placeholderTask.id,
      message: "Object removal task created successfully",
    });
  } catch (error) {
    if (placeholderTaskId) {
      await updateObjectRemovalTask(placeholderTaskId, {
        taskStatus: "failed",
        errorMsg: getErrorMessage(error),
        executeEndTime: BigInt(Date.now()),
      }).catch(() => null);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { nanoid } from "nanoid";
import { z } from "zod";

import { prisma } from "@/db/prisma";
import { updateObjectRemovalTask } from "@/db/queries/object-removal";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import { ImageInputError, readTrustedRemoteImage } from "@/lib/image-input";
import {
  markImageTaskReservationFailed,
  reserveImageTask,
} from "@/lib/image-task-reservation";
import { buildRemoveNodeInfoList } from "@/lib/remove-objects/runninghub";
import {
  anonymousPrincipalCookie,
  createAnonymousPrincipal,
  getAnonymousPrincipalFromRequest,
  TaskLifecycleError,
} from "@/lib/task-lifecycle";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import { runninghubAPI } from "@/modules/runninghub";

const RemoveSchema = z.object({
  imageUrl: z.string().url(),
  maskUrl: z.string().url(),
  prompt: z.string().trim().max(120).optional(),
  authorizationConfirmed: z.boolean().optional().default(false),
  authorizationPolicyVersion: z.string().trim().max(40).optional(),
  authorizationSubject: z.string().trim().max(120).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let placeholderTaskId: number | undefined;
  let runninghubTaskId: string | undefined;
  let json = (payload: unknown, init?: ResponseInit) =>
    NextResponse.json(payload, init);

  try {
    const body = RemoveSchema.parse(await req.json());
    const user = await getCurrentUser();
    const prompt = body.prompt || undefined;
    const idempotencyKey = req.headers.get("idempotency-key")?.trim() || null;
    if (!body.authorizationConfirmed) {
      return NextResponse.json(
        {
          error:
            "Authorization confirmation is required before removing an object",
          code: "AUTHORIZATION_REQUIRED",
        },
        { status: 400 },
      );
    }
    const incomingToken = req.cookies.get("remove_anything_principal")?.value;
    const principalId = user?.id ? null : getAnonymousPrincipalFromRequest(req);
    const principalToken = user?.id
      ? null
      : principalId
        ? incomingToken
        : createAnonymousPrincipal();
    const resolvedPrincipalId = user?.id
      ? null
      : principalId ||
        getAnonymousPrincipalFromRequest(
          new Request(req.url, {
            headers: { cookie: `remove_anything_principal=${principalToken}` },
          }),
        );
    json = (payload: unknown, init?: ResponseInit) => {
      const response = NextResponse.json(payload, init);
      if (!user?.id && principalToken && !principalId)
        response.headers.append(
          "Set-Cookie",
          anonymousPrincipalCookie(principalToken),
        );
      return response;
    };

    const reservation = await reserveImageTask({
      model: "objectRemovalTask",
      principal: { userId: user?.id || null, principalId: resolvedPrincipalId },
      idempotencyKey,
      data: {
        runninghubTaskId: `pending-${nanoid(10)}`,
        inputImageUrl: body.imageUrl,
        inputMaskUrl: body.maskUrl,
        detectPrompt: prompt,
        authorizationConfirmed: body.authorizationConfirmed,
        authorizationPolicyVersion:
          body.authorizationPolicyVersion || "removal-auth-v1",
        authorizationSubject:
          body.authorizationSubject || "image-owner-or-authorized-editor",
        authorizationConfirmedAt: new Date(),
        auditExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    const placeholderTask = reservation.task;
    if (reservation.idempotent) {
      if (
        placeholderTask.taskStatus === "queued" &&
        placeholderTask.runninghubTaskId.startsWith("pending-")
      ) {
        const response = json(
          {
            error:
              "Task is still starting. Retry with the same idempotency key.",
            code: "TASK_STARTING",
          },
          { status: 409 },
        );
        response.headers.set("Retry-After", "2");
        return response;
      }
      return json({
        success: true,
        taskId: placeholderTask.runninghubTaskId,
        recordId: placeholderTask.id,
        status: placeholderTask.taskStatus,
        idempotent: true,
      });
    }

    placeholderTaskId = placeholderTask.id;

    const tool = getToolRegistryEntry("remove-objects")!;
    const imageOptions = {
      maxBytes: tool.limits.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: tool.inputFormats,
      maxPixels: tool.limits.maxPixels,
    };
    const [image, mask] = await Promise.all([
      readTrustedRemoteImage(body.imageUrl, imageOptions),
      readTrustedRemoteImage(body.maskUrl, {
        ...imageOptions,
        allowedMimeTypes: ["image/png"],
      }),
    ]);
    if (image.width !== mask.width || image.height !== mask.height) {
      throw new ImageInputError(
        "MASK_DIMENSIONS_MISMATCH",
        "The image and PNG mask must have the same dimensions",
        400,
      );
    }

    runninghubTaskId = await runninghubAPI.createObjectRemoveTask(
      buildRemoveNodeInfoList(body.imageUrl, body.maskUrl, prompt),
      placeholderTask.id,
    );

    try {
      await updateObjectRemovalTask(placeholderTask.id, {
        runninghubTaskId,
      });
      await prisma.objectRemovalTask.updateMany({
        where: { id: placeholderTask.id, taskStatus: "queued" },
        data: {
          taskStatus: "processing",
          executeStartTime: BigInt(Date.now()),
          errorMsg: null,
        },
      });
    } catch (updateError) {
      await runninghubAPI.cancelTask(runninghubTaskId).catch(() => null);
      throw updateError;
    }

    return json({
      success: true,
      taskId: runninghubTaskId,
      recordId: placeholderTask.id,
      message: "Object removal task created successfully",
    });
  } catch (error) {
    if (
      (error as { code?: string })?.code === "TASK_CREATION_OUTCOME_UNKNOWN"
    ) {
      return json(
        {
          error: getErrorMessage(error),
          code: "TASK_CREATION_OUTCOME_UNKNOWN",
          recoverable: true,
        },
        { status: 503 },
      );
    }
    if (placeholderTaskId) {
      await markImageTaskReservationFailed(
        "objectRemovalTask",
        placeholderTaskId,
        error,
      ).catch(() => null);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid request" },
        { status: 400 },
      );
    }

    if (error instanceof TaskLifecycleError)
      return json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    if (error instanceof ImageInputError)
      return json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

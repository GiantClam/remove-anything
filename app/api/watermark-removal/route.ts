import { NextRequest, NextResponse } from "next/server";

import JSZip from "jszip";
import { nanoid } from "nanoid";

import { prisma } from "@/db/prisma";
import { updateWatermarkRemovalTask } from "@/db/queries/watermark-removal";
import { getCurrentUser } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
import {
  ImageInputError,
  readTrustedRemoteImage,
  validateImageFile,
} from "@/lib/image-input";
import {
  markImageTaskReservationFailed,
  reserveImageTask,
} from "@/lib/image-task-reservation";
import {
  anonymousPrincipalCookie,
  createAnonymousPrincipal,
  getAnonymousPrincipalFromRequest,
  TaskLifecycleError,
} from "@/lib/task-lifecycle";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import { uploadToR2 } from "@/lib/upload";
import { runninghubAPI } from "@/modules/runninghub";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let placeholderTaskId: number | undefined;
  let json = (body: unknown, init?: ResponseInit) =>
    NextResponse.json(body, init);
  try {
    const tool = getToolRegistryEntry("remove-watermark");
    if (!tool)
      return json({ error: "Tool configuration unavailable" }, { status: 503 });
    const user = await getCurrentUser();
    const userId = user?.id || null;
    const idempotencyKey = req.headers.get("idempotency-key")?.trim() || null;
    const incomingToken = req.cookies.get("remove_anything_principal")?.value;
    const principalId = userId ? null : getAnonymousPrincipalFromRequest(req);
    const principalToken = userId
      ? null
      : principalId
        ? incomingToken
        : createAnonymousPrincipal();
    const resolvedPrincipalId = userId
      ? null
      : principalId ||
        getAnonymousPrincipalFromRequest(
          new Request(req.url, {
            headers: { cookie: `remove_anything_principal=${principalToken}` },
          }),
        );
    json = (body: unknown, init?: ResponseInit) => {
      const response = NextResponse.json(body, init);
      if (!userId && principalToken && !principalId)
        response.headers.append(
          "Set-Cookie",
          anonymousPrincipalCookie(principalToken),
        );
      return response;
    };

    let imageFiles: File[] = [];
    let imageUrls: string[] = [];
    let authorizationConfirmed = false;
    let authorizationPolicyVersion = "removal-auth-v1";
    let authorizationSubject = "image-owner-or-authorized-editor";
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await req.formData();
      imageFiles = formData.getAll("images") as File[];
      authorizationConfirmed =
        formData.get("authorizationConfirmed") === "true";
      authorizationPolicyVersion = String(
        formData.get("authorizationPolicyVersion") ||
          authorizationPolicyVersion,
      );
      authorizationSubject = String(
        formData.get("authorizationSubject") || authorizationSubject,
      );
    } else {
      const data = await req.json();
      if (
        !Array.isArray(data.imageUrls) ||
        data.imageUrls.some((url: unknown) => typeof url !== "string")
      ) {
        return json(
          { error: "A valid image URLs array is required" },
          { status: 400 },
        );
      }
      imageUrls = data.imageUrls;
      authorizationConfirmed = data.authorizationConfirmed === true;
      authorizationPolicyVersion = String(
        data.authorizationPolicyVersion || authorizationPolicyVersion,
      );
      authorizationSubject = String(
        data.authorizationSubject || authorizationSubject,
      );
    }
    const imageCount = imageFiles.length || imageUrls.length;
    if (imageCount === 0)
      return json({ error: "No images provided" }, { status: 400 });
    if (imageCount > 1) {
      return json(
        {
          error:
            "The free watermark tool supports one image per task. Batch output is not available yet.",
          code: "PAID_OUTPUT_UNAVAILABLE",
          maxFiles: 1,
        },
        { status: 402 },
      );
    }
    if (!authorizationConfirmed) {
      return json(
        {
          error:
            "Authorization confirmation is required before removing a watermark",
          code: "AUTHORIZATION_REQUIRED",
        },
        { status: 400 },
      );
    }

    const reservation = await reserveImageTask({
      model: "watermarkRemovalTask",
      principal: { userId, principalId: resolvedPrincipalId },
      idempotencyKey,
      data: {
        runninghubTaskId: `pending-${nanoid(12)}`,
        inputZipUrl: "",
        authorizationConfirmed: true,
        authorizationPolicyVersion,
        authorizationSubject,
        authorizationConfirmedAt: new Date(),
        auditExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    const taskRecord = reservation.task;
    if (reservation.idempotent) {
      if (
        taskRecord.taskStatus === "queued" &&
        taskRecord.runninghubTaskId.startsWith("pending-")
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
        taskId: taskRecord.runninghubTaskId,
        taskRecordId: taskRecord.id,
        status: taskRecord.taskStatus,
        idempotent: true,
      });
    }
    placeholderTaskId = taskRecord.id;
    const inputOptions = {
      maxBytes: tool.limits.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: tool.inputFormats,
      maxPixels: tool.limits.maxPixels,
    };
    const input = imageUrls.length
      ? await readTrustedRemoteImage(imageUrls[0], inputOptions)
      : await validateImageFile(imageFiles[0], inputOptions);

    const zip = new JSZip();
    const file = input.file;
    const extension =
      file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    zip.file(`image_1.${extension}`, await file.arrayBuffer());
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipUrl = await uploadToR2(
      new File([new Uint8Array(zipBuffer)], "images.zip", {
        type: "application/zip",
      }),
    );
    await updateWatermarkRemovalTask(taskRecord.id, { inputZipUrl: zipUrl });
    const filename = await runninghubAPI.uploadZip(zipBuffer);
    const providerTaskId = await runninghubAPI.createWatermarkRemovalTask(
      filename,
      taskRecord.id,
    );
    try {
      await updateWatermarkRemovalTask(taskRecord.id, {
        runninghubTaskId: providerTaskId,
      });
      await prisma.watermarkRemovalTask.updateMany({
        where: { id: taskRecord.id, taskStatus: "queued" },
        data: {
          taskStatus: "processing",
          executeStartTime: BigInt(Date.now()),
        },
      });
    } catch (error) {
      await runninghubAPI.cancelTask(providerTaskId).catch(() => null);
      throw error;
    }
    return json({
      success: true,
      taskId: providerTaskId,
      taskRecordId: taskRecord.id,
      status: "processing",
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
    if (placeholderTaskId)
      await markImageTaskReservationFailed(
        "watermarkRemovalTask",
        placeholderTaskId,
        error,
      ).catch(() => null);
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
    const message = getErrorMessage(error);
    return json({ error: message }, { status: 500 });
  }
}

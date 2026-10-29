import { NextResponse, type NextRequest } from "next/server";

import { nanoid } from "nanoid";

import { prisma } from "@/db/prisma";
// import { aiGateway } from "@/lib/ai-gateway"; // 切换到 RunningHub
import { env } from "@/env.mjs";
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
import { kv, KVRateLimit } from "@/lib/kv";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import {
  createTaskOutputR2S3Service,
  resolveTaskObjectSignedUrl,
  resolveTaskOutputBucket,
} from "@/lib/r2-s3";
import {
  anonymousPrincipalCookie,
  createAnonymousPrincipal,
  getAnonymousPrincipalFromRequest,
  TaskLifecycleError,
  verifyAnonymousPrincipal,
} from "@/lib/task-lifecycle";
import { getToolRegistryEntry } from "@/lib/tool-registry";
import { createRunningHubClient } from "@/modules/runninghub";

const ratelimit = new KVRateLimit(kv, {
  limit: 10,
  window: "10s",
});

function getKey(id: string) {
  return `generate:${id}`;
}

export const maxDuration = 60;

// 简化的文件上传到R2的函数
async function uploadToR2(file: File): Promise<string> {
  let uploadKey = "";
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("📤 开始上传文件到R2...");
    }

    // 生成唯一文件名
    const fileExtension = file.name.split(".").pop() || "jpg";
    const filename = `${nanoid(12)}.${fileExtension}`;
    const key = `background-removal/${filename}`;
    uploadKey = key;

    // 转换文件为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const outputBucket = resolveTaskOutputBucket();
    const s3Client = createTaskOutputR2S3Service();

    if (process.env.NODE_ENV !== "production") {
      console.log("文件大小:", buffer.length, "bytes");
      console.log("文件类型:", file.type);
      console.log("上传键:", key);
      console.log("上传桶:", outputBucket);
    }
    await s3Client.putPrivateItemInBucket(key, buffer, file.type || undefined);
    const locatorUrl = `${env.R2_URL_BASE.replace(/\/$/, "")}/${key}`;
    if (process.env.NODE_ENV !== "production") {
      console.log("✅ 文件上传成功:", locatorUrl);
    }

    return locatorUrl;
  } catch (error: any) {
    console.error("❌ 文件上传失败:", error);

    // 如果是认证错误，提供更详细的调试信息（仅在非生产环境输出）
    if (
      error.code === "SignatureDoesNotMatch" &&
      process.env.NODE_ENV !== "production"
    ) {
      console.error("🔍 R2认证调试信息:");
      console.error("- R2_ACCESS_KEY长度:", env.R2_ACCESS_KEY?.length);
      console.error("- R2_SECRET_KEY长度:", env.R2_SECRET_KEY?.length);
      console.error("- 上传目标键:", uploadKey);
    }

    throw error;
  }
}

export async function POST(req: NextRequest) {
  const tool = getToolRegistryEntry("remove-background")!;
  let reservationId: number | undefined;
  let providerTaskId: string | undefined;
  const user = await getCurrentUser();
  const userId = user?.id || null; // 对于匿名用户，使用null而不是"anonymous"
  const idempotencyKey = req.headers.get("idempotency-key")?.trim() || null;
  const incomingPrincipalToken = req.cookies.get(
    "remove_anything_principal",
  )?.value;
  const verifiedPrincipalId = getAnonymousPrincipalFromRequest(req);
  const hasPrincipalCookie = Boolean(verifiedPrincipalId);
  const principalToken = userId
    ? null
    : hasPrincipalCookie
      ? incomingPrincipalToken
      : createAnonymousPrincipal();
  const principalId = userId
    ? null
    : verifiedPrincipalId || verifyAnonymousPrincipal(principalToken);
  const json = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    if (!userId && principalToken && !hasPrincipalCookie)
      response.headers.append(
        "Set-Cookie",
        anonymousPrincipalCookie(principalToken),
      );
    return response;
  };

  const { success } = await ratelimit.limit(
    getKey(userId || "anonymous") + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return json(
      { error: "Too Many Requests", code: "RATE_LIMITED" },
      {
        status: 429,
      },
    );
  }

  try {
    // 检查Content-Type，支持FormData和JSON两种格式
    const contentType = req.headers.get("content-type") || "";

    let imageUrl = "";
    let imageFile: File | undefined;

    if (contentType.includes("multipart/form-data")) {
      // 处理FormData格式
      const formData = await req.formData();
      const image = formData.get("image");

      if (!(image instanceof File)) {
        return NextResponse.json(
          { error: "No image provided" },
          { status: 400 },
        );
      }
      if (image.size > tool.limits.maxFileSizeMb * 1024 * 1024) {
        return NextResponse.json(
          {
            error: `Image exceeds the ${tool.limits.maxFileSizeMb}MB limit`,
            code: "FILE_TOO_LARGE",
            maxFileSizeMb: tool.limits.maxFileSizeMb,
          },
          { status: 413 },
        );
      }

      if (!tool.inputFormats.includes(image.type.toLowerCase())) {
        return json(
          {
            error: "Use a PNG, JPEG, or WebP image",
            code: "UNSUPPORTED_IMAGE_TYPE",
          },
          { status: 415 },
        );
      }
      imageFile = image;
    } else {
      // 处理JSON格式
      const data = await req.json();
      imageUrl = data.image || data.inputImageUrl;

      try {
        const source = new URL(imageUrl);
        if (source.protocol !== "https:" || source.username || source.password)
          throw new Error("Invalid source URL");
      } catch {
        return json(
          {
            error: "Provide a valid HTTPS image URL",
            code: "INVALID_IMAGE_URL",
          },
          { status: 400 },
        );
      }
    }

    const { task: taskRecord, idempotent } = await reserveImageTask({
      model: "backgroundRemovalTask",
      principal: { userId, principalId },
      idempotencyKey,
      data: {
        replicateId: `pending-${nanoid(16)}`,
        inputImageUrl: imageUrl,
        resolution: "1024x1024",
        model: "runninghub/background-removal",
      },
    });
    if (idempotent) {
      if (taskRecord.replicateId.startsWith("pending-")) {
        return json(
          {
            error:
              "Your original request is still starting. Retry with the same idempotency key.",
            code: "TASK_STARTING",
          },
          { status: 409, headers: { "Retry-After": "2" } },
        );
      }
      return json({
        success: true,
        taskId: taskRecord.replicateId,
        taskRecordId: taskRecord.id,
        status: taskRecord.taskStatus,
        idempotent: true,
      });
    }
    reservationId = taskRecord.id;
    const imageOptions = {
      maxBytes: tool.limits.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: tool.inputFormats,
      maxPixels: tool.limits.maxPixels,
    };
    if (imageFile) {
      const validated = await validateImageFile(imageFile, imageOptions);
      imageFile = validated.file;
      imageUrl = await uploadToR2(imageFile);
      await prisma.backgroundRemovalTask.update({
        where: { id: taskRecord.id },
        data: { inputImageUrl: imageUrl },
      });
    } else {
      await readTrustedRemoteImage(imageUrl, imageOptions);
    }

    const rh = createRunningHubClient();
    const workflowId = "1977998138864795650";
    const uploadNodeId = "233"; // image node

    // R2 input objects are private in staging and production. Keep the stable
    // object URL in the task record, but give RunningHub a short-lived signed
    // GET URL so its worker can fetch the bytes without bucket credentials.
    const providerImageUrl = (() => {
      const key = getR2ObjectKey(imageUrl, env.R2_URL_BASE);
      if (!key) return Promise.resolve(imageUrl);
      return resolveTaskObjectSignedUrl(key, 60 * 60);
    })();

    let runninghubTaskId: string;
    try {
      runninghubTaskId = await rh.createTaskGeneric({
        workflowId,
        nodeInfoList: [
          {
            nodeId: uploadNodeId,
            fieldName: "image",
            fieldValue: await providerImageUrl,
          },
        ],
        taskRecordId: taskRecord.id,
      });
    } catch (e: any) {
      console.error("❌ RunningHub 创建任务失败:", e);
      throw e;
    }

    providerTaskId = runninghubTaskId;
    await prisma.backgroundRemovalTask.update({
      where: { id: taskRecord.id },
      data: { replicateId: runninghubTaskId },
    });
    await prisma.backgroundRemovalTask.updateMany({
      where: { id: taskRecord.id, taskStatus: "queued" },
      data: { taskStatus: "processing", executeStartTime: BigInt(Date.now()) },
    });

    // 启动任务状态监控
    try {
      const { taskQueueManager } = await import("@/lib/task-queue");
      taskQueueManager.startStatusWatcher(
        taskRecord.id,
        runninghubTaskId,
        "background-removal",
      );
      console.log("✅ 任务状态监控已启动");
    } catch (error) {
      console.error("❌ 启动任务状态监控失败:", error);
      // 不影响主流程，继续执行
    }

    // This route consumes the server's free allowance. Paid full-resolution
    // output needs a separate, approved entitlement before it can charge.
    // 返回任务信息
    return json({
      success: true,
      taskId: runninghubTaskId,
      taskRecordId: taskRecord?.id,
      status: "processing",
    });
  } catch (error) {
    console.error("❌ 处理失败:", error);
    if (
      (error as { code?: string })?.code === "TASK_CREATION_OUTCOME_UNKNOWN"
    ) {
      return json(
        {
          error:
            "The provider has not confirmed whether this task started. Keep the same request key and contact support before starting another task.",
          code: "TASK_CREATION_OUTCOME_UNKNOWN",
          taskRecordId: reservationId,
        },
        { status: 503 },
      );
    }
    if (providerTaskId)
      await createRunningHubClient()
        .cancelTask?.(providerTaskId)
        .catch(() => null);
    if (reservationId)
      await markImageTaskReservationFailed(
        "backgroundRemovalTask",
        reservationId,
        error,
      ).catch(() => null);
    if (error instanceof TaskLifecycleError) {
      return json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof ImageInputError) {
      return json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

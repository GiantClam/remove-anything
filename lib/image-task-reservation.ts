import "server-only";

import type { BackgroundRemovalTask, ObjectRemovalTask, Prisma, WatermarkRemovalTask } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { enforceImageTaskQuota, taskExpiresAt, TaskLifecycleError, type TaskPrincipal } from "@/lib/task-lifecycle";

export const MAX_IMAGE_TASK_RESERVATION_ATTEMPTS = 3;
export type ImageTaskModel = "backgroundRemovalTask" | "watermarkRemovalTask" | "objectRemovalTask";
type TaskByModel = {
  backgroundRemovalTask: BackgroundRemovalTask;
  watermarkRemovalTask: WatermarkRemovalTask;
  objectRemovalTask: ObjectRemovalTask;
};
type DataByModel = {
  backgroundRemovalTask: Prisma.BackgroundRemovalTaskUncheckedCreateInput;
  watermarkRemovalTask: Prisma.WatermarkRemovalTaskUncheckedCreateInput;
  objectRemovalTask: Prisma.ObjectRemovalTaskUncheckedCreateInput;
};

export type ImageTaskReservationOptions<Model extends ImageTaskModel> = {
  model: Model;
  principal: TaskPrincipal;
  idempotencyKey?: string | null;
  data: DataByModel[Model];
  now?: Date;
};

/** Reserve one free slot before storage or provider side effects start. */
export async function reserveImageTask<Model extends ImageTaskModel>(
  options: ImageTaskReservationOptions<Model>,
): Promise<{ task: TaskByModel[Model]; idempotent: boolean }> {
  const now = options.now || new Date();
  if (!options.principal.userId && !options.principal.principalId) {
    throw new TaskLifecycleError("A task principal is required", "QUOTA_STORAGE_UNAVAILABLE");
  }
  for (let attempt = 0; attempt < MAX_IMAGE_TASK_RESERVATION_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const where = {
          idempotencyKey: options.idempotencyKey,
          ...(options.principal.userId
            ? { userId: options.principal.userId }
            : { userId: null, principalId: options.principal.principalId }),
          taskStatus: { notIn: ["failed", "expired"] },
        };
        if (options.idempotencyKey) {
          const query = { where, orderBy: { createdAt: "desc" as const } };
          const existing = options.model === "backgroundRemovalTask"
            ? await tx.backgroundRemovalTask.findFirst(query)
            : options.model === "watermarkRemovalTask"
              ? await tx.watermarkRemovalTask.findFirst(query)
              : await tx.objectRemovalTask.findFirst(query);
          if (existing) return { task: existing as TaskByModel[Model], idempotent: true };
        }

        await enforceImageTaskQuota(options.principal, now, tx);
        const data = {
          ...options.data,
          userId: options.principal.userId,
          principalId: options.principal.userId ? null : options.principal.principalId,
          idempotencyKey: options.idempotencyKey || null,
          taskStatus: "queued",
          expiresAt: taskExpiresAt(now),
        };
        const task = options.model === "backgroundRemovalTask"
          ? await tx.backgroundRemovalTask.create({ data: data as DataByModel["backgroundRemovalTask"] })
          : options.model === "watermarkRemovalTask"
            ? await tx.watermarkRemovalTask.create({ data: data as DataByModel["watermarkRemovalTask"] })
            : await tx.objectRemovalTask.create({ data: data as DataByModel["objectRemovalTask"] });
        return { task: task as TaskByModel[Model], idempotent: false };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2034") throw error;
      if (attempt === MAX_IMAGE_TASK_RESERVATION_ATTEMPTS - 1) {
        throw new TaskLifecycleError("Task reservation is busy. Retry this request with the same idempotency key.", "QUOTA_STORAGE_UNAVAILABLE");
      }
    }
  }
  throw new TaskLifecycleError("Task reservation failed", "QUOTA_STORAGE_UNAVAILABLE");
}

/** Failed setup returns its free slot; successful/provider-owned work is untouched. */
export async function markImageTaskReservationFailed(model: ImageTaskModel, id: number, error: unknown) {
  const data = {
    taskStatus: "failed",
    errorMsg: error instanceof Error ? error.message : String(error),
    executeEndTime: BigInt(Date.now()),
  };
  const args = { where: { id, taskStatus: { in: ["queued", "pending", "starting"] } }, data };
  if (model === "backgroundRemovalTask") return prisma.backgroundRemovalTask.updateMany(args);
  if (model === "watermarkRemovalTask") return prisma.watermarkRemovalTask.updateMany(args);
  return prisma.objectRemovalTask.updateMany(args);
}

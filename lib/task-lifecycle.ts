import "server-only";

import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/db/prisma";
import {
  ANALYTICS_EVENTS,
  createCreditsAnalyticsEvent,
} from "@/lib/analytics-events";
import { emitServerAnalyticsEvent } from "@/lib/server-analytics-events";

export const ANONYMOUS_PRINCIPAL_COOKIE = "remove_anything_principal";
export const TASK_RESULT_TTL_MS = 24 * 60 * 60 * 1000;
export const TASK_AUDIT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const ANONYMOUS_TASK_WINDOW_MS = TASK_RESULT_TTL_MS;
export const AUTHENTICATED_MONTHLY_TASK_LIMIT = 5;
export const ANONYMOUS_TASK_LIMIT = 1;
export const MAX_AUTOMATIC_RETRIES = 1;

export type TaskLifecycleStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "expired";

export type TaskPrincipal = {
  userId: string | null;
  principalId: string | null;
};

export class TaskLifecycleError extends Error {
  constructor(
    message: string,
    public readonly code: "QUOTA_EXCEEDED" | "QUOTA_STORAGE_UNAVAILABLE" | "TASK_EXPIRED" | "TASK_FORBIDDEN",
    public readonly status = code === "QUOTA_EXCEEDED" ? 429 : 503,
  ) {
    super(message);
    this.name = "TaskLifecycleError";
  }
}

function signingSecret() {
  const secret = process.env.ANONYMOUS_PRINCIPAL_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  // Keep local builds usable while refusing a predictable secret in production.
  if (process.env.NODE_ENV !== "production") return "remove-anything-local-principal-secret";
  throw new TaskLifecycleError("Anonymous principal signing is not configured", "QUOTA_STORAGE_UNAVAILABLE");
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

/** Creates or verifies the opaque, signed anonymous subject cookie. */
export function createAnonymousPrincipal() {
  const payload = encode(JSON.stringify({
    sub: crypto.randomUUID(),
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
  }));
  return `${payload}.${sign(payload)}`;
}

export function verifyAnonymousPrincipal(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  const expected = payload ? sign(payload) : "";
  if (!payload || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(decode(payload)) as { sub?: unknown; exp?: unknown };
    if (typeof parsed.sub !== "string" || typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

export function getAnonymousPrincipalFromRequest(req: Request) {
  const raw = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${ANONYMOUS_PRINCIPAL_COOKIE}=([^;]+)`))?.[1];
  return verifyAnonymousPrincipal(raw);
}

/** Keep the signed anonymous subject available after the browser signs in. */
export function getTaskPrincipalFromRequest(req: Request, userId: string | null | undefined): TaskPrincipal {
  return {
    userId: userId || null,
    principalId: getAnonymousPrincipalFromRequest(req),
  };
}

export function anonymousPrincipalCookie(token: string) {
  return `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}; Path=/; Max-Age=${365 * 24 * 60 * 60}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function normalizeTaskStatus(value: unknown): TaskLifecycleStatus {
  const status = String(value || "").toLowerCase();
  if (["queued", "pending", "starting", "waiting"].includes(status)) return "queued";
  if (["processing", "running", "in_progress", "in-progress"].includes(status)) return "processing";
  if (["succeeded", "success", "completed", "complete", "done"].includes(status)) return "succeeded";
  if (["expired", "timeout", "timed_out"].includes(status)) return "expired";
  return "failed";
}

export function taskExpiresAt(createdAt: Date | number = Date.now()) {
  return new Date((createdAt instanceof Date ? createdAt.getTime() : createdAt) + TASK_RESULT_TTL_MS);
}

export function taskAuditExpiresAt(createdAt: Date | number = Date.now()) {
  return new Date((createdAt instanceof Date ? createdAt.getTime() : createdAt) + TASK_AUDIT_RETENTION_MS);
}

export function isTaskExpired(task: { expiresAt?: Date | null; createdAt?: Date | null }) {
  return (task.expiresAt || (task.createdAt ? taskExpiresAt(task.createdAt) : null))?.getTime()! <= Date.now();
}

function startOfUtcMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type ImageTaskQuotaStorage = Pick<
  Prisma.TransactionClient,
  "backgroundRemovalTask" | "watermarkRemovalTask" | "objectRemovalTask" | "taskData"
>;

/** Use the reservation transaction so concurrent submissions share one quota decision. */
export async function enforceImageTaskQuota(
  principal: TaskPrincipal,
  now = new Date(),
  storage: ImageTaskQuotaStorage = prisma,
) {
  const activeStatuses = ["queued", "pending", "starting", "processing", "running", "succeeded", "expired"];
  try {
    if (principal.userId) {
      const [backgroundCount, watermarkCount, objectCount, taskDataCount] = await Promise.all([
        storage.backgroundRemovalTask.count({ where: { userId: principal.userId, createdAt: { gte: startOfUtcMonth(now) }, taskStatus: { in: activeStatuses } } }),
        storage.watermarkRemovalTask.count({ where: { userId: principal.userId, createdAt: { gte: startOfUtcMonth(now) }, taskStatus: { in: activeStatuses } } }),
        storage.objectRemovalTask.count({ where: { userId: principal.userId, createdAt: { gte: startOfUtcMonth(now) }, taskStatus: { in: activeStatuses } } }),
        storage.taskData.count({ where: { userId: principal.userId, createdAt: { gte: startOfUtcMonth(now) }, taskStatus: { in: activeStatuses }, model: { not: "sora2-video-watermark-removal" } } }),
      ]);
      const count = backgroundCount + watermarkCount + objectCount + taskDataCount;
      if (count >= AUTHENTICATED_MONTHLY_TASK_LIMIT) {
        throw new TaskLifecycleError("Monthly image task quota exceeded. Your free allowance resets next UTC calendar month.", "QUOTA_EXCEEDED");
      }
      return { limit: AUTHENTICATED_MONTHLY_TASK_LIMIT, used: count };
    }
    if (!principal.principalId) throw new TaskLifecycleError("Anonymous principal is required", "QUOTA_STORAGE_UNAVAILABLE");
    const [backgroundCount, watermarkCount, objectCount, taskDataCount] = await Promise.all([
      storage.backgroundRemovalTask.count({ where: { principalId: principal.principalId, createdAt: { gte: new Date(now.getTime() - ANONYMOUS_TASK_WINDOW_MS) }, taskStatus: { in: activeStatuses } } }),
      storage.watermarkRemovalTask.count({ where: { principalId: principal.principalId, createdAt: { gte: new Date(now.getTime() - ANONYMOUS_TASK_WINDOW_MS) }, taskStatus: { in: activeStatuses } } }),
      storage.objectRemovalTask.count({ where: { principalId: principal.principalId, createdAt: { gte: new Date(now.getTime() - ANONYMOUS_TASK_WINDOW_MS) }, taskStatus: { in: activeStatuses } } }),
      storage.taskData.count({ where: { principalId: principal.principalId, createdAt: { gte: new Date(now.getTime() - ANONYMOUS_TASK_WINDOW_MS) }, taskStatus: { in: activeStatuses }, model: { not: "sora2-video-watermark-removal" } } }),
    ]);
    const count = backgroundCount + watermarkCount + objectCount + taskDataCount;
    if (count >= ANONYMOUS_TASK_LIMIT) throw new TaskLifecycleError("Anonymous task quota exceeded. Your free allowance resets after 24 hours; sign in for the monthly free allowance.", "QUOTA_EXCEEDED");
    return { limit: ANONYMOUS_TASK_LIMIT, used: count };
  } catch (error) {
    if (error instanceof TaskLifecycleError) throw error;
    // The caller retries the entire serializable reservation, including counts.
    if ((error as { code?: string })?.code === "P2034") throw error;
    throw new TaskLifecycleError("Task quota could not be checked", "QUOTA_STORAGE_UNAVAILABLE");
  }
}

export function canRetryAutomatically(retryCount: number | null | undefined) {
  return (retryCount || 0) < MAX_AUTOMATIC_RETRIES;
}

export type TaskOwnershipRecord = {
  userId?: string | null;
  principalId?: string | null;
  taskStatus?: string | null;
  outputImageUrl?: string | null;
  outputZipUrl?: string | null;
  imageUrl?: string | null;
  expiresAt?: Date | null;
  createdAt?: Date | null;
};

/** Verify the subject before returning any task status or result metadata. */
export function assertTaskOwnership(task: TaskOwnershipRecord, principal: TaskPrincipal) {
  if (isTaskExpired(task)) throw new TaskLifecycleError("Task result has expired", "TASK_EXPIRED", 410);
  const ownerMatches = task.userId
    ? Boolean(principal.userId && task.userId === principal.userId)
    : Boolean(task.principalId && principal.principalId && task.principalId === principal.principalId);
  if (!ownerMatches) throw new TaskLifecycleError("Task is not authorized", "TASK_FORBIDDEN", 403);
}

export function assertTaskDownloadAccess(task: TaskOwnershipRecord, principal: TaskPrincipal) {
  if (normalizeTaskStatus(task.taskStatus) !== "succeeded" || !(task.outputImageUrl || task.outputZipUrl || task.imageUrl)) {
    throw new TaskLifecycleError("Task result is not available", "TASK_FORBIDDEN", 404);
  }
  assertTaskOwnership(task, principal);
}

/** Return a real pre-consumed debit once; free work never creates credits. */
export async function refundFailedTaskCredit(
  userId: string | null | undefined,
  taskId: number,
  taskType: "background-removal" | "image" = "image",
) {
  if (!userId || process.env.NODE_ENV === "development") return false;

  const refunded = await prisma.$transaction(async (tx) => {
    const task = taskType === "background-removal"
      ? await tx.backgroundRemovalTask.findFirst({ where: { id: taskId, userId } })
      : await tx.taskData.findFirst({ where: { id: taskId, userId } });
    if (!task || !["failed", "canceled", "cancelled"].includes(task.taskStatus.toLowerCase())) return null;

    const withdrawal = await tx.userBilling.findFirst({
      where: {
        userId,
        type: "Withdraw",
        state: "Done",
        ...(taskType === "background-removal"
          ? { description: `Background Removal - Task ${task.replicateId}` }
          : { taskId }),
      },
      orderBy: { id: "asc" },
    });
    if (!withdrawal) return null;

    const description = `Task credit refund - withdrawal ${withdrawal.id}`;
    const existing = await tx.userBilling.findFirst({
      where: {
        userId,
        type: "Refund",
        OR: [
          { description },
          // Keep retries compatible with refunds created before the debit CAS.
          { description: `Task credit refund - ${taskId}` },
          ...(withdrawal.taskId ? [{ taskId: withdrawal.taskId }] : []),
        ],
      },
    });
    if (existing) return null;

    const debits = await tx.userCreditTransaction.findMany({
      where: { userId, billingId: withdrawal.id, credit: { lt: 0 } },
      select: { credit: true },
    });
    const amount = -debits.reduce((total, debit) => total + debit.credit, 0);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount !== Math.abs(withdrawal.amount)) return null;
    const credit = await tx.userCredit.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
    if (!credit) return null;

    // The original debit is the lock shared by callbacks and status watchers.
    const claimed = await tx.userBilling.updateMany({
      where: { id: withdrawal.id, userId, type: "Withdraw", state: "Done" },
      data: { state: "Refunded" },
    });
    if (claimed.count === 0) return null;

    const updatedCredit = await tx.userCredit.update({
      where: { id: credit.id },
      data: { credit: { increment: amount } },
    });
    const billing = await tx.userBilling.create({
      data: { userId, state: "Done", amount, type: "Refund", taskId: withdrawal.taskId, description },
    });
    const transaction = await tx.userCreditTransaction.create({
      data: { userId, credit: amount, balance: updatedCredit.credit, billingId: billing.id, type: "Task credit refund" },
    });
    return { transactionId: transaction.id, amount, balance: updatedCredit.credit };
  });

  if (!refunded) return false;
  await emitServerAnalyticsEvent(createCreditsAnalyticsEvent(ANALYTICS_EVENTS.creditsRefunded, {
    transaction_id: refunded.transactionId,
    task_id: String(taskId),
    is_authenticated: true,
    credits_before: refunded.balance - refunded.amount,
    credits_after: refunded.balance,
  }));
  return true;
}

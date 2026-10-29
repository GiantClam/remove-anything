import { buildMediaTransformUrl } from "./cf-media";

export const SORA2_VIDEO_WATERMARK_TASK_TYPE = "sora2-video-watermark-removal";

const SDK_VIDEO_WATERMARK_TASK_TYPE = "video-watermark-removal";

type ProcessingQueueItem = {
  id: number | string;
  taskType: string;
  payload: Record<string, unknown> | null;
  retryCount?: number | null;
};

export type StaleVideoQueueItem = {
  id: number | string;
  taskType: string;
  payload: Record<string, unknown> | null;
  updatedAt: Date;
};

type StaleVideoQueueTransaction = {
  processingQueue: {
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
  taskData: {
    updateMany(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
};

export type VideoTaskNodeInfo = {
  nodeId: string;
  fieldName: string;
  fieldValue: string;
};

export class PermanentTaskQueueError extends Error {
  readonly retryable = false;
}

export class TransformReadinessQueueError extends Error {
  readonly code = "TRANSFORM_READINESS_NOT_READY";
  readonly retryable = true;
  readonly providerCreationAttempted = false;
}

export class QueueDeadlineExceededError extends Error {
  readonly code = "QUEUE_DEADLINE_EXCEEDED";
  readonly retryable = true;
  readonly providerCreationAttempted = false;
}

export class ProviderTaskCreatedPersistenceError extends Error {
  readonly code = "PROVIDER_TASK_CREATED_PERSISTENCE_FAILED";
  readonly providerTaskCreated = true;
  readonly taskRecordId: number;
  readonly providerTaskId: string;

  constructor(taskRecordId: number, providerTaskId: string, message: string) {
    super(message);
    this.name = "ProviderTaskCreatedPersistenceError";
    this.taskRecordId = taskRecordId;
    this.providerTaskId = providerTaskId;
  }
}

export type ProcessingQueueUpdate = {
  status: "pending" | "completed" | "failed";
  retryCount?: number;
  lastError?: string;
  scheduledAt?: Date;
};

export type VideoQueueDispatchOutcome =
  | "completed"
  | "retrying"
  | "failed"
  | "lease-lost";

export type ProcessingQueueClaimSnapshot = {
  id: number | string;
  taskType: string;
  scheduledAt: Date;
  retryCount: number;
};

export type ProcessingQueueLease = {
  claimedAt: Date;
  taskType: string;
  scheduledAt: Date;
  retryCount: number;
};

export const VIDEO_QUEUE_LEASE_MS = 2 * 60_000;
export const VIDEO_QUEUE_RECOVERY_BATCH_SIZE = 20;
export const VIDEO_QUEUE_RUN_BUDGET_MS = 45_000;
export const VIDEO_QUEUE_MIN_TASK_WINDOW_MS = 33_000;
export const VIDEO_QUEUE_RETRY_DELAY_MS = 60_000;
export const VIDEO_QUEUE_RECONCILIATION_REQUIRED_CODE =
  "VIDEO_QUEUE_RECONCILIATION_REQUIRED";
export const VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR = `${VIDEO_QUEUE_RECONCILIATION_REQUIRED_CODE}: Queue worker lease expired before the provider task ID was recorded. The provider outcome needs reconciliation; do not resubmit this task.`;
export const VIDEO_QUEUE_RECONCILIATION_ACTIVE_STATUSES = [
  "pending",
  "Pending",
  "queued",
  "Queued",
  "starting",
  "Starting",
  "processing",
  "Processing",
  "running",
  "RUNNING",
] as const;

export const VIDEO_QUEUE_TASK_TYPE_FILTER = {
  OR: [
    { taskType: SORA2_VIDEO_WATERMARK_TASK_TYPE },
    {
      taskType: SDK_VIDEO_WATERMARK_TASK_TYPE,
      payload: {
        path: ["model"],
        equals: SORA2_VIDEO_WATERMARK_TASK_TYPE,
      },
    },
  ],
} as const;

export function hasVideoQueueTaskBudget(
  deadlineAt: number,
  now = Date.now(),
): boolean {
  return deadlineAt - now >= VIDEO_QUEUE_MIN_TASK_WINDOW_MS;
}

export function getVideoQueueTransformWaitBudget(
  deadlineAt: number,
  now = Date.now(),
): number {
  return Math.min(120_000, deadlineAt - now - VIDEO_QUEUE_MIN_TASK_WINDOW_MS);
}

/** Compare-and-set a due pending row and persist its lease start timestamp. */
export async function claimVideoQueueItem(
  snapshot: ProcessingQueueClaimSnapshot,
  updateMany: (args: {
    where: {
      id: number | string;
      taskType: string;
      status: "pending";
      retryCount: number;
      scheduledAt: { equals: Date; lte: Date };
    };
    data: { status: "running"; updatedAt: Date };
  }) => Promise<{ count: number }>,
  now: () => Date = () => new Date(),
): Promise<Date | null> {
  const claimedAt = now();
  const claim = await updateMany({
    where: {
      id: snapshot.id,
      taskType: snapshot.taskType,
      status: "pending",
      retryCount: snapshot.retryCount,
      scheduledAt: { equals: snapshot.scheduledAt, lte: claimedAt },
    },
    data: { status: "running", updatedAt: claimedAt },
  });
  return claim.count === 1 ? claimedAt : null;
}

/**
 * Fail a bounded page of expired video leases without replaying provider work.
 * A worker can be killed after provider creation but before recording its ID,
 * so stale recovery must not turn ambiguous submissions back into pending.
 */
export async function recoverStaleVideoQueueItems(
  findMany: (args: {
    where: {
      status: "running";
      OR: ReadonlyArray<Record<string, unknown>>;
      updatedAt: { lt: Date };
    };
    orderBy: { updatedAt: "asc" };
    take: number;
    select: { id: true; taskType: true; payload: true; updatedAt: true };
  }) => Promise<StaleVideoQueueItem[]>,
  recoverOne: (
    item: StaleVideoQueueItem,
    cutoff: Date,
    recoveredAt: Date,
  ) => Promise<boolean>,
  now: () => Date = () => new Date(),
  leaseMs = VIDEO_QUEUE_LEASE_MS,
): Promise<number> {
  const recoveredAt = now();
  const cutoff = new Date(recoveredAt.getTime() - leaseMs);
  const stale = await findMany({
    where: {
      ...VIDEO_QUEUE_TASK_TYPE_FILTER,
      status: "running",
      updatedAt: { lt: cutoff },
    },
    orderBy: { updatedAt: "asc" },
    take: VIDEO_QUEUE_RECOVERY_BATCH_SIZE,
    select: { id: true, taskType: true, payload: true, updatedAt: true },
  });

  if (stale.length === 0) return 0;

  let recovered = 0;
  for (const item of stale) {
    if (await recoverOne(item, cutoff, recoveredAt)) recovered++;
  }
  return recovered;
}

/**
 * Fail one stale queue row and expose its unknown provider outcome atomically.
 * A task with a linked provider ID or terminal lifecycle state is left alone.
 */
export async function recoverStaleVideoQueueItemInTransaction(
  transaction: StaleVideoQueueTransaction,
  item: StaleVideoQueueItem,
  cutoff: Date,
  recoveredAt = new Date(),
): Promise<boolean> {
  const queueUpdate = await transaction.processingQueue.updateMany({
    where: {
      AND: [
        VIDEO_QUEUE_TASK_TYPE_FILTER,
        {
          id: item.id,
          taskType: item.taskType,
          status: "running",
        },
        {
          updatedAt: {
            equals: item.updatedAt,
            lt: cutoff,
          },
        },
      ],
    },
    data: {
      status: "failed",
      lastError: VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR,
    },
  });
  if (queueUpdate.count !== 1) return false;

  const taskRecordId = getQueuedTaskRecordId(item.payload);
  if (taskRecordId !== null) {
    await transaction.taskData.updateMany({
      where: {
        id: taskRecordId,
        model: SORA2_VIDEO_WATERMARK_TASK_TYPE,
        replicateId: null,
        taskStatus: { in: VIDEO_QUEUE_RECONCILIATION_ACTIVE_STATUSES },
      },
      data: {
        taskStatus: "Processing",
        errorMsg: VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR,
        updatedAt: recoveredAt,
      },
    });
  }
  return true;
}

export function getQueuedTaskRecordId(
  payload: Record<string, unknown> | null,
): number | null {
  const id = Number(payload?.taskRecordId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function isUnknownVideoSubmissionError(error: unknown): boolean {
  return (
    typeof error === "string" &&
    (error.includes(VIDEO_QUEUE_RECONCILIATION_REQUIRED_CODE) ||
      /TASK_CREATION_OUTCOME_UNKNOWN|outcome is unknown/i.test(error))
  );
}

export function getUnknownVideoSubmissionCode(error: unknown): string | null {
  if (typeof error !== "string") return null;
  if (error.includes(VIDEO_QUEUE_RECONCILIATION_REQUIRED_CODE)) {
    return VIDEO_QUEUE_RECONCILIATION_REQUIRED_CODE;
  }
  return /TASK_CREATION_OUTCOME_UNKNOWN|outcome is unknown/i.test(error)
    ? "TASK_CREATION_OUTCOME_UNKNOWN"
    : null;
}

export function getUnknownVideoSubmissionUpdatedAt(
  error: unknown,
  createdAt: Date,
  updatedAt: Date,
): Date {
  return typeof error === "string" &&
    error.includes(VIDEO_QUEUE_RECONCILIATION_REQUIRED_CODE)
    ? updatedAt
    : createdAt;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Dispatch one durable video queue item. Only typed pre-provider failures are
 * retryable, and each dispatch outcome is fenced by the original claim time.
 */
export async function dispatchVideoQueueItem(
  item: ProcessingQueueItem,
  deps: {
    updateQueueItem(
      id: number | string,
      data: ProcessingQueueUpdate,
      lease: ProcessingQueueLease,
    ): Promise<boolean>;
    processSora2VideoWatermarkRemoval(
      task: Record<string, unknown>,
      deadlineAt?: number,
    ): Promise<void>;
    lease: ProcessingQueueLease;
    deadlineAt?: number;
    now?: () => number;
  },
): Promise<VideoQueueDispatchOutcome> {
  const task = createTaskProcessorInput(item);
  if (!task) {
    const updated = await deps.updateQueueItem(
      item.id,
      {
        status: "failed",
        lastError: `Unsupported processing queue task type: ${item.taskType}`,
      },
      deps.lease,
    );
    return updated ? "failed" : "lease-lost";
  }

  try {
    await deps.processSora2VideoWatermarkRemoval(
      {
        ...task,
        retryCount: item.retryCount ?? 0,
      },
      deps.deadlineAt,
    );
    const updated = await deps.updateQueueItem(
      item.id,
      { status: "completed" },
      deps.lease,
    );
    return updated ? "completed" : "lease-lost";
  } catch (error) {
    const retryCount =
      Number.isSafeInteger(item.retryCount) && (item.retryCount ?? 0) >= 0
        ? (item.retryCount ?? 0)
        : -1;
    const canRetryOnce =
      (error instanceof TransformReadinessQueueError ||
        error instanceof QueueDeadlineExceededError) &&
      error.providerCreationAttempted === false &&
      retryCount === 0;

    if (canRetryOnce) {
      const now = deps.now?.() ?? Date.now();
      const updated = await deps.updateQueueItem(
        item.id,
        {
          status: "pending",
          retryCount: retryCount + 1,
          lastError: errorMessage(error),
          scheduledAt: new Date(now + VIDEO_QUEUE_RETRY_DELAY_MS),
        },
        deps.lease,
      );
      return updated ? "retrying" : "lease-lost";
    }

    const updated = await deps.updateQueueItem(
      item.id,
      {
        status: "failed",
        lastError: errorMessage(error),
      },
      deps.lease,
    );
    return updated ? "failed" : "lease-lost";
  }
}

export async function enqueueSora2VideoQueueItem(
  queue: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  },
  args: {
    payload: Record<string, unknown>;
    lastError: string;
  },
) {
  await queue.create({
    data: {
      taskType: SORA2_VIDEO_WATERMARK_TASK_TYPE,
      payload: args.payload,
      status: "pending",
      retryCount: 0,
      lastError: args.lastError,
      scheduledAt: new Date(),
    },
  });
}

export function getSora2SubmissionDisposition(result: {
  ok: boolean;
  recordId: number | string;
  taskId?: string;
  error?: string;
  submissionOutcome?: "unknown" | "rejected" | "created";
}) {
  if ((result.ok || result.submissionOutcome === "created") && result.taskId) {
    return {
      accepted: true,
      status: "processing" as const,
      recordId: result.recordId,
      taskId: result.taskId,
    };
  }

  if (
    result.submissionOutcome === "unknown" ||
    result.submissionOutcome === "created" ||
    result.ok
  ) {
    return {
      accepted: true,
      status: "submission-unknown" as const,
      recordId: result.recordId,
      code:
        result.submissionOutcome === "created" || result.ok
          ? ("TASK_CREATED_ID_UNAVAILABLE" as const)
          : ("TASK_CREATION_OUTCOME_UNKNOWN" as const),
      error: result.error,
    };
  }

  return {
    accepted: false,
    status: "failed" as const,
    recordId: result.recordId,
    code: "TASK_CREATION_REJECTED" as const,
    error: result.error,
  };
}

export function createTaskProcessorInput(item: ProcessingQueueItem) {
  const payload = item.payload ?? {};
  const isCurrentSora2Task = item.taskType === SORA2_VIDEO_WATERMARK_TASK_TYPE;
  const isLegacySdkSora2Retry =
    item.taskType === SDK_VIDEO_WATERMARK_TASK_TYPE &&
    payload.model === SORA2_VIDEO_WATERMARK_TASK_TYPE;

  if (!isCurrentSora2Task && !isLegacySdkSora2Retry) return null;

  return {
    id: `cron_${item.id}`,
    taskType: SORA2_VIDEO_WATERMARK_TASK_TYPE,
    metadata: payload,
  };
}

function isNodeInfoList(value: unknown): value is VideoTaskNodeInfo[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (node) =>
        node &&
        typeof node.nodeId === "string" &&
        typeof node.fieldName === "string" &&
        typeof node.fieldValue === "string",
    )
  );
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function resolveSora2VideoQueueMetadata(
  metadata: Record<string, unknown>,
  workflows: {
    landscape?: string;
    portrait?: string;
  },
  r2UrlBase = "https://s.remove-anything.com",
) {
  const taskRecordId = Number(metadata.taskRecordId);
  if (!Number.isSafeInteger(taskRecordId) || taskRecordId <= 0) {
    throw new PermanentTaskQueueError("任务记录ID未找到");
  }

  const orientation =
    metadata.orientation === "portrait" ? "portrait" : "landscape";
  const rawNodeInfoList = metadata.nodeInfoList;
  if (rawNodeInfoList !== undefined && !isNodeInfoList(rawNodeInfoList)) {
    throw new PermanentTaskQueueError("视频工作流节点配置无效");
  }
  const providedNodes = isNodeInfoList(rawNodeInfoList)
    ? rawNodeInfoList
    : undefined;
  const providedTransformUrl = nonEmptyString(metadata.transformUrl);
  const nodeVideoUrl = providedNodes?.find(
    (node) => node.fieldName === "video",
  )?.fieldValue;
  let transformUrl = providedTransformUrl ?? nodeVideoUrl;
  const zone = new URL(r2UrlBase);
  const isOwnedTransform = (value: string | undefined) => {
    if (!value) return false;
    try {
      const candidate = new URL(value);
      return (
        candidate.protocol === "https:" &&
        candidate.host.toLowerCase() === zone.host.toLowerCase() &&
        candidate.pathname.startsWith("/cdn-cgi/media/")
      );
    } catch {
      return false;
    }
  };
  let shouldWaitForTransform = isOwnedTransform(transformUrl);
  const r2Url = nonEmptyString(metadata.r2Url);
  if (!transformUrl && r2Url) {
    try {
      const source = new URL(r2Url);
      if (source.protocol !== "https:" && source.protocol !== "http:") {
        throw new PermanentTaskQueueError("视频输入URL协议无效");
      }
      if (source.username || source.password) {
        throw new PermanentTaskQueueError("视频输入URL不能包含认证信息");
      }
      if (source.host.toLowerCase() === zone.host.toLowerCase()) {
        const width = orientation === "portrait" ? 704 : 1280;
        const height = orientation === "portrait" ? 1280 : 704;
        transformUrl = buildMediaTransformUrl(zone.host, r2Url, {
          width,
          height,
          fit: "scale-down",
          audio: true,
        });
        shouldWaitForTransform = true;
      } else {
        // External URLs are passed to the provider directly. Do not make an
        // application-server request to arbitrary caller-supplied hosts.
        transformUrl = r2Url;
      }
    } catch (error) {
      if (error instanceof PermanentTaskQueueError) throw error;
      throw new PermanentTaskQueueError("视频输入URL无效");
    }
  }

  if (!transformUrl) {
    throw new PermanentTaskQueueError("视频输入URL未找到");
  }

  if (providedNodes && nodeVideoUrl) {
    try {
      const nodeUrl = new URL(nodeVideoUrl);
      if (
        (nodeUrl.protocol !== "https:" && nodeUrl.protocol !== "http:") ||
        nodeUrl.username ||
        nodeUrl.password
      ) {
        throw new PermanentTaskQueueError("视频输入URL无效");
      }
    } catch (error) {
      if (error instanceof PermanentTaskQueueError) throw error;
      throw new PermanentTaskQueueError("视频输入URL无效");
    }
  }

  const workflowId =
    nonEmptyString(metadata.workflowId) ??
    (orientation === "portrait" ? workflows.portrait : workflows.landscape);
  if (!workflowId || workflowId === "placeholder") {
    throw new PermanentTaskQueueError(
      "Workflow ID not configured. Please set SORA2_LANDSCAPE_WORKFLOW_ID and SORA2_PORTRAIT_WORKFLOW_ID environment variables.",
    );
  }

  return {
    taskRecordId,
    userId: nonEmptyString(metadata.userId),
    r2Url: r2Url ?? transformUrl,
    transformUrl,
    workflowId,
    shouldWaitForTransform,
    nodeInfoList: providedNodes ?? [
      {
        nodeId: orientation === "portrait" ? "153" : "205",
        fieldName: "video",
        fieldValue: transformUrl,
      },
    ],
  };
}

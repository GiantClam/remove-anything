import { buildMediaTransformUrl } from "./cf-media";

export const SORA2_VIDEO_WATERMARK_TASK_TYPE = "sora2-video-watermark-removal";

const SDK_VIDEO_WATERMARK_TASK_TYPE = "video-watermark-removal";

type ProcessingQueueItem = {
  id: number | string;
  taskType: string;
  payload: Record<string, unknown> | null;
  retryCount?: number | null;
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

export type ProcessingQueueClaimSnapshot = {
  id: number | string;
  scheduledAt: Date;
  retryCount: number;
};

/** Compare-and-set a due pending queue row before any provider submission. */
export async function claimVideoQueueItem(
  snapshot: ProcessingQueueClaimSnapshot,
  updateMany: (args: {
    where: {
      id: number | string;
      status: "pending";
      retryCount: number;
      scheduledAt: { equals: Date; lte: Date };
    };
    data: { status: "running" };
  }) => Promise<{ count: number }>,
  now: () => Date = () => new Date(),
): Promise<boolean> {
  const freshNow = now();
  const claim = await updateMany({
    where: {
      id: snapshot.id,
      status: "pending",
      retryCount: snapshot.retryCount,
      scheduledAt: { equals: snapshot.scheduledAt, lte: freshNow },
    },
    data: { status: "running" },
  });
  return claim.count === 1;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Dispatch one durable video queue item. Only transform readiness is a safe
 * retry: it is typed and occurs before the provider task-creation request.
 */
export async function dispatchVideoQueueItem(
  item: ProcessingQueueItem,
  deps: {
    updateQueueItem(
      id: number | string,
      data: ProcessingQueueUpdate,
    ): Promise<void>;
    processSora2VideoWatermarkRemoval(
      task: Record<string, unknown>,
    ): Promise<void>;
    now?: () => number;
  },
): Promise<"completed" | "retrying" | "failed"> {
  const task = createTaskProcessorInput(item);
  if (!task) {
    await deps.updateQueueItem(item.id, {
      status: "failed",
      lastError: `Unsupported processing queue task type: ${item.taskType}`,
    });
    return "failed";
  }

  try {
    await deps.processSora2VideoWatermarkRemoval({
      ...task,
      retryCount: item.retryCount ?? 0,
    });
    await deps.updateQueueItem(item.id, { status: "completed" });
    return "completed";
  } catch (error) {
    const retryCount =
      Number.isSafeInteger(item.retryCount) && (item.retryCount ?? 0) >= 0
        ? (item.retryCount ?? 0)
        : 0;
    const canRetryOnce =
      error instanceof TransformReadinessQueueError &&
      error.providerCreationAttempted === false &&
      retryCount < 1;

    if (canRetryOnce) {
      const now = deps.now?.() ?? Date.now();
      await deps.updateQueueItem(item.id, {
        status: "pending",
        retryCount: retryCount + 1,
        lastError: errorMessage(error),
        scheduledAt: new Date(now + 60_000),
      });
      return "retrying";
    }

    await deps.updateQueueItem(item.id, {
      status: "failed",
      lastError: errorMessage(error),
    });
    return "failed";
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

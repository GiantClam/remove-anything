export const recordStatusState = {
  task: null as Record<string, any> | null,
  providerStatusCalls: 0,
  providerResultCalls: 0,
  providerStatus: "RUNNING" as string,
  providerStatusAsString: false,
  providerResult: { code: 0, data: [] as Array<Record<string, unknown>> },
  providerResultError: null as Error | null,
  migrationError: null as Error | null,
  migrationCalls: [] as Array<{ url: string; kind: string; recordId: number }>,
  compareAndSetCalls: [] as Array<Record<string, unknown>>,
  compareAndSetCallbackResult: null as Record<string, unknown> | null,
  persistedOutput:
    "https://files.example.test/sora2-video-watermark-removal/processed/77-callback-hash.mp4",
};

export function resetRecordStatusState(
  task: Record<string, any> | null = null,
) {
  recordStatusState.task = task;
  recordStatusState.providerStatusCalls = 0;
  recordStatusState.providerResultCalls = 0;
  recordStatusState.providerStatus = "RUNNING";
  recordStatusState.providerStatusAsString = false;
  recordStatusState.providerResult = { code: 0, data: [] };
  recordStatusState.providerResultError = null;
  recordStatusState.migrationError = null;
  recordStatusState.migrationCalls.length = 0;
  recordStatusState.compareAndSetCalls.length = 0;
  recordStatusState.compareAndSetCallbackResult = null;
  recordStatusState.persistedOutput =
    "https://files.example.test/sora2-video-watermark-removal/processed/77-callback-hash.mp4";
}

export async function findSora2VideoWatermarkRemovalTaskById(id: number) {
  return recordStatusState.task?.id === id
    ? { ...recordStatusState.task }
    : null;
}

export async function findSora2VideoWatermarkRemovalTaskByRunningHubId(
  runninghubTaskId: string,
) {
  return recordStatusState.task?.replicateId === runninghubTaskId
    ? { ...recordStatusState.task }
    : null;
}

export async function updateSora2VideoWatermarkRemovalTask(
  id: number,
  data: Record<string, unknown>,
) {
  if (recordStatusState.task?.id === id) {
    Object.assign(recordStatusState.task, data);
  }
  return { id, ...data };
}

export const prisma = {
  taskData: {
    async updateMany(args: Record<string, any>) {
      recordStatusState.compareAndSetCalls.push(args);
      const task = recordStatusState.task;
      if (!task) return { count: 0 };
      if (recordStatusState.compareAndSetCallbackResult) {
        Object.assign(task, recordStatusState.compareAndSetCallbackResult);
        return { count: 0 };
      }

      if (task.id !== args.where.id) return { count: 0 };
      const excludedStatuses = args.where.taskStatus?.notIn ?? [];
      if (excludedStatuses.includes(task.taskStatus)) return { count: 0 };

      const imageUrl = task.imageUrl as string | null;
      const alternatives = args.where.OR as Array<Record<string, any>>;
      const canWrite = alternatives.some((condition) => {
        if (Object.prototype.hasOwnProperty.call(condition, "imageUrl")) {
          const value = condition.imageUrl;
          if (value === null || typeof value === "string")
            return imageUrl === value;
        }
        const r2Prefix = condition.NOT?.imageUrl?.startsWith;
        if (typeof r2Prefix === "string")
          return !imageUrl?.startsWith(r2Prefix);
        return false;
      });
      if (!canWrite) return { count: 0 };

      Object.assign(task, args.data);
      return { count: 1 };
    },
  },
};

export function shouldSkipDatabaseQuery() {
  return false;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const env = { R2_URL_BASE: "https://files.example.test" };

export function getR2ObjectKey(url?: string | null) {
  if (!url || !url.startsWith(`${env.R2_URL_BASE}/`)) return null;
  return url.slice(`${env.R2_URL_BASE}/`.length) || null;
}

export async function persistRunningHubOutput(
  url: string,
  kind: string,
  recordId: number,
) {
  recordStatusState.migrationCalls.push({ url, kind, recordId });
  if (recordStatusState.migrationError) {
    const migrationError = recordStatusState.migrationError;
    recordStatusState.migrationError = null;
    throw migrationError;
  }
  return recordStatusState.persistedOutput;
}

export function normalizeTaskStatus(value: unknown) {
  const status = String(value ?? "").toLowerCase();
  if (["queued", "pending", "starting", "waiting"].includes(status))
    return "queued";
  if (["processing", "running", "in_progress", "in-progress"].includes(status))
    return "processing";
  if (
    ["succeeded", "success", "completed", "complete", "done"].includes(status)
  )
    return "succeeded";
  if (["expired", "timeout", "timed_out"].includes(status)) return "expired";
  return "failed";
}

export const runninghubAPI = {
  async getTaskStatus() {
    recordStatusState.providerStatusCalls++;
    return {
      code: 0,
      data: recordStatusState.providerStatusAsString
        ? recordStatusState.providerStatus
        : { status: recordStatusState.providerStatus },
    };
  },
  async getTaskResult() {
    recordStatusState.providerResultCalls++;
    if (recordStatusState.providerResultError)
      throw recordStatusState.providerResultError;
    return recordStatusState.providerResult;
  },
};

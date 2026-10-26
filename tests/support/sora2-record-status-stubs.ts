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
  recordStatusState.persistedOutput =
    "https://files.example.test/sora2-video-watermark-removal/processed/77-callback-hash.mp4";
}

export async function findSora2VideoWatermarkRemovalTaskById(id: number) {
  return recordStatusState.task?.id === id
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
  if (recordStatusState.migrationError) throw recordStatusState.migrationError;
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

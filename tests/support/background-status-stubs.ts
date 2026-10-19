import type { BackgroundRemovalTask } from "@prisma/client";

export const env = { R2_URL_BASE: "https://storage.example.test" };

export const backgroundStatusState = {
  user: { id: "background-owner" } as { id: string } | null,
  task: null as BackgroundRemovalTask | null,
  providerStatus: "RUNNING",
  providerOutput: "https://provider.example.test/result.png" as string | null,
  providerCalls: 0,
  resultCalls: 0,
  readError: false,
  writeError: false,
  providerError: false,
  updates: [] as Record<string, unknown>[],
  beforeUpdate: null as (() => void) | null,
  beforeStatus: null as (() => void | Promise<void>) | null,
  beforeResult: null as (() => void | Promise<void>) | null,
  beforeMigration: null as (() => void | Promise<void>) | null,
  migrationError: false,
  migratedOutput: "https://storage.example.test/background-removal/processed/private-result.png",
  migrationCalls: [] as { url: string; kind: string; recordId: number }[],
};

export function resetBackgroundStatusState() {
  const state = backgroundStatusState;
  state.user = { id: "background-owner" };
  state.task = {
    id: 17,
    userId: "background-owner",
    principalId: null,
    replicateId: "background-17",
    inputImageUrl: "https://input.example.test/source.png",
    outputImageUrl: null,
    resolution: "1024x1024",
    model: "men1scus/birefnet",
    taskStatus: "pending",
    executeStartTime: null,
    executeEndTime: null,
    errorMsg: null,
    downloadCount: 0,
    viewCount: 0,
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    retryCount: 0,
    idempotencyKey: null,
    retentionCheckedAt: null,
    retentionCleanedAt: null,
  };
  state.providerStatus = "RUNNING";
  state.providerOutput = "https://provider.example.test/result.png";
  state.providerCalls = 0;
  state.resultCalls = 0;
  state.readError = false;
  state.writeError = false;
  state.providerError = false;
  state.updates.length = 0;
  state.beforeUpdate = null;
  state.beforeStatus = null;
  state.beforeResult = null;
  state.beforeMigration = null;
  state.migrationError = false;
  state.migratedOutput = "https://storage.example.test/background-removal/processed/private-result.png";
  state.migrationCalls.length = 0;
}

export async function findBackgroundRemovalTaskByReplicateId(taskId: string) {
  if (backgroundStatusState.readError) throw new Error("Injected database read failure");
  const task = backgroundStatusState.task;
  return task?.replicateId === taskId ? { ...task } : null;
}

export async function getCurrentUser() {
  return backgroundStatusState.user;
}

export const runninghubAPI = {
  getTaskStatus: async () => {
    backgroundStatusState.providerCalls++;
    await backgroundStatusState.beforeStatus?.();
    if (backgroundStatusState.providerError) throw new Error("Injected provider status failure");
    return { code: 0, data: { status: backgroundStatusState.providerStatus } };
  },
  getTaskResult: async () => {
    backgroundStatusState.resultCalls++;
    await backgroundStatusState.beforeResult?.();
    return {
      code: 0,
      data: backgroundStatusState.providerOutput
        ? [{ fileUrl: backgroundStatusState.providerOutput }]
        : [],
    };
  },
};

export const backgroundStatusPrisma = {
  backgroundRemovalTask: {
    updateMany: async ({ where, data }: { where: { id: number; taskStatus: string; outputImageUrl: string | null; expiresAt?: Date | null }; data: Record<string, unknown> }) => {
      const state = backgroundStatusState;
      if (state.writeError) throw new Error("Injected database write failure");
      state.beforeUpdate?.();
      state.beforeUpdate = null;
      if (!state.task || state.task.id !== where.id || state.task.taskStatus !== where.taskStatus || state.task.outputImageUrl !== where.outputImageUrl ||
        (where.expiresAt !== undefined && state.task.expiresAt?.getTime() !== where.expiresAt?.getTime())) {
        return { count: 0 };
      }
      state.task = { ...state.task, ...data };
      state.updates.push({ ...data });
      return { count: 1 };
    },
  },
};

export async function persistRunningHubOutput(url: string, kind: string, recordId: number) {
  backgroundStatusState.migrationCalls.push({ url, kind, recordId });
  await backgroundStatusState.beforeMigration?.();
  if (backgroundStatusState.migrationError) throw new Error("Injected private storage failure");
  return backgroundStatusState.migratedOutput;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

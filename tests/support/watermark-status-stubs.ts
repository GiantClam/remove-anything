export const env = { R2_URL_BASE: "https://files.example.test" };

type WatermarkTask = {
  id: number;
  userId: string | null;
  principalId?: string | null;
  taskStatus: string;
  outputZipUrl: string | null;
  inputZipUrl: string;
  errorMsg: string | null;
  createdAt: Date;
  expiresAt: Date;
  executeStartTime: bigint | null;
  executeEndTime: bigint | null;
};

export const watermarkStatusState = {
  user: null as { id: string } | null,
  task: null as WatermarkTask | null,
  statusResult: { code: 0, data: { status: "PROCESSING" } } as {
    code: number;
    data: string | { status?: string; error?: string };
  },
  outputResult: {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/result.zip" }],
  } as { code: number; data: unknown },
  statusError: null as Error | null,
  outputError: null as Error | null,
  updateError: null as Error | null,
  migrationError: null as Error | null,
  migrationCalls: [] as { url: string; kind: string; recordId: number }[],
  persistedOutput:
    "https://files.example.test/watermark-removal/processed/31-output.zip",
  onStatus: null as (() => void) | null,
  onOutput: null as (() => void) | null,
  providerCalls: [] as string[],
  outputCalls: [] as string[],
  updates: [] as {
    id: number;
    where: { id: number; taskStatus: string; outputZipUrl: string | null };
    data: Record<string, unknown>;
    count: number;
  }[],
};

export function resetWatermarkStatusState() {
  watermarkStatusState.user = { id: "watermark-owner" };
  watermarkStatusState.task = {
    id: 31,
    userId: "watermark-owner",
    taskStatus: "processing",
    inputZipUrl: "https://files.example.test/private/input.zip",
    outputZipUrl: null,
    errorMsg: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    executeStartTime: null,
    executeEndTime: null,
  };
  watermarkStatusState.statusResult = {
    code: 0,
    data: { status: "PROCESSING" },
  };
  watermarkStatusState.outputResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/result.zip" }],
  };
  watermarkStatusState.statusError = null;
  watermarkStatusState.outputError = null;
  watermarkStatusState.updateError = null;
  watermarkStatusState.migrationError = null;
  watermarkStatusState.migrationCalls.length = 0;
  watermarkStatusState.persistedOutput =
    "https://files.example.test/watermark-removal/processed/31-output.zip";
  watermarkStatusState.onStatus = null;
  watermarkStatusState.onOutput = null;
  watermarkStatusState.providerCalls.length = 0;
  watermarkStatusState.outputCalls.length = 0;
  watermarkStatusState.updates.length = 0;
}

export async function getCurrentUser() {
  return watermarkStatusState.user;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function findWatermarkRemovalTaskByRunningHubId() {
  return watermarkStatusState.task ? { ...watermarkStatusState.task } : null;
}

export const prisma = {
  watermarkRemovalTask: {
    async updateMany({
      where,
      data,
    }: {
      where: {
        id: number;
        taskStatus: string;
        outputZipUrl: string | null;
        expiresAt: Date;
      };
      data: Record<string, unknown>;
    }) {
      if (watermarkStatusState.updateError)
        throw watermarkStatusState.updateError;
      const task = watermarkStatusState.task;
      const count =
        task?.id === where.id &&
        task.taskStatus === where.taskStatus &&
        task.outputZipUrl === where.outputZipUrl &&
        task.expiresAt.getTime() === where.expiresAt.getTime()
          ? 1
          : 0;
      watermarkStatusState.updates.push({ id: where.id, where, data, count });
      if (count) Object.assign(task!, data);
      return { count };
    },
  },
};

export async function persistRunningHubOutput(
  url: string,
  kind: string,
  recordId: number,
) {
  watermarkStatusState.migrationCalls.push({ url, kind, recordId });
  if (watermarkStatusState.migrationError)
    throw watermarkStatusState.migrationError;
  return watermarkStatusState.persistedOutput;
}

export const runninghubAPI = {
  async getTaskStatus(taskId: string) {
    watermarkStatusState.providerCalls.push(taskId);
    watermarkStatusState.onStatus?.();
    if (watermarkStatusState.statusError)
      throw watermarkStatusState.statusError;
    return watermarkStatusState.statusResult;
  },
  async getTaskResult(taskId: string) {
    watermarkStatusState.outputCalls.push(taskId);
    watermarkStatusState.onOutput?.();
    if (watermarkStatusState.outputError)
      throw watermarkStatusState.outputError;
    return watermarkStatusState.outputResult;
  },
};

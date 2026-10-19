type ObjectTask = {
  id: number;
  userId: string | null;
  principalId?: string | null;
  taskStatus: string;
  outputImageUrl: string | null;
  inputImageUrl: string;
  errorMsg: string | null;
  createdAt: Date;
  expiresAt: Date;
  executeStartTime: bigint | null;
  executeEndTime: bigint | null;
};
type CasWhere = {
  id: number;
  taskStatus: string;
  outputImageUrl: string | null;
  expiresAt: Date | null;
};

export const env = { R2_URL_BASE: "https://files.example.test" };
export const objectStatusState = {
  user: null as { id: string } | null,
  task: null as ObjectTask | null,
  statusResult: { code: 0, data: { status: "RUNNING" } } as {
    code: number;
    data: string | { status?: string; error?: string };
  },
  outputResult: {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/results/output.png" }],
  } as { code: number; data: unknown },
  persistedOutput:
    "https://files.example.test/object-removal/processed/51-callback-hash.png",
  statusError: null as Error | null,
  outputError: null as Error | null,
  migrationError: null as Error | null,
  updateError: null as Error | null,
  onStatus: null as (() => void) | null,
  onOutput: null as (() => void) | null,
  onMigration: null as (() => void) | null,
  statusCalls: [] as string[],
  outputCalls: [] as string[],
  createCalls: 0,
  migrationCalls: [] as { url: string; kind: string; recordId: number }[],
  updates: [] as {
    where: CasWhere;
    data: Record<string, unknown>;
    count: number;
  }[],
};

export function resetObjectStatusState() {
  const state = objectStatusState;
  state.user = { id: "object-owner" };
  state.task = {
    id: 51,
    userId: "object-owner",
    taskStatus: "processing",
    outputImageUrl: null,
    inputImageUrl: "https://files.example.test/private/input.png",
    errorMsg: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    executeStartTime: null,
    executeEndTime: null,
  };
  state.statusResult = { code: 0, data: { status: "RUNNING" } };
  state.outputResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/results/output.png" }],
  };
  state.persistedOutput =
    "https://files.example.test/object-removal/processed/51-callback-hash.png";
  state.statusError = null;
  state.outputError = null;
  state.migrationError = null;
  state.updateError = null;
  state.onStatus = null;
  state.onOutput = null;
  state.onMigration = null;
  state.statusCalls.length = 0;
  state.outputCalls.length = 0;
  state.migrationCalls.length = 0;
  state.updates.length = 0;
  state.createCalls = 0;
}

export async function getCurrentUser() {
  return objectStatusState.user;
}
export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
export async function findObjectRemovalTaskByRunningHubId() {
  return objectStatusState.task ? { ...objectStatusState.task } : null;
}
export const prisma = {
  objectRemovalTask: {
    async updateMany({
      where,
      data,
    }: {
      where: CasWhere;
      data: Record<string, unknown>;
    }) {
      if (objectStatusState.updateError) throw objectStatusState.updateError;
      const task = objectStatusState.task;
      const count =
        task?.id === where.id &&
        task.taskStatus === where.taskStatus &&
        task.outputImageUrl === where.outputImageUrl &&
        (task.expiresAt?.getTime() ?? null) ===
          (where.expiresAt?.getTime() ?? null)
          ? 1
          : 0;
      objectStatusState.updates.push({ where, data, count });
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
  objectStatusState.migrationCalls.push({ url, kind, recordId });
  objectStatusState.onMigration?.();
  if (objectStatusState.migrationError) throw objectStatusState.migrationError;
  return objectStatusState.persistedOutput;
}
export const runninghubAPI = {
  async getTaskStatus(id: string) {
    objectStatusState.statusCalls.push(id);
    objectStatusState.onStatus?.();
    if (objectStatusState.statusError) throw objectStatusState.statusError;
    return objectStatusState.statusResult;
  },
  async getTaskResult(id: string) {
    objectStatusState.outputCalls.push(id);
    objectStatusState.onOutput?.();
    if (objectStatusState.outputError) throw objectStatusState.outputError;
    return objectStatusState.outputResult;
  },
  async createTaskGeneric() {
    objectStatusState.createCalls++;
    throw new Error("Status reads must never create provider work");
  },
};

export const sora2RouteState = {
  user: { id: "sora-owner" } as { id: string } | null,
  providerError: null as Error | null,
  providerTaskId: "runninghub-created-1",
  providerUploadCalls: 0,
  providerCreateCalls: 0,
  uploadCreateArguments: [] as unknown[][],
  nextRecordId: 71,
  records: [] as Array<Record<string, unknown>>,
  queueRows: [] as Array<Record<string, unknown>>,
  taskUpdates: [] as Array<Record<string, unknown>>,
  taskUpdateError: null as Error | null,
  creditUpdates: [] as Array<Record<string, unknown>>,
  watchers: [] as unknown[],
  transformError: null as Error | null,
  orchestratorResult: null as Record<string, unknown> | null,
  orchestratorCalls: [] as Array<Record<string, unknown>>,
};

export function resetSora2RouteState() {
  sora2RouteState.user = { id: "sora-owner" };
  sora2RouteState.providerError = null;
  sora2RouteState.providerTaskId = "runninghub-created-1";
  sora2RouteState.providerUploadCalls = 0;
  sora2RouteState.providerCreateCalls = 0;
  sora2RouteState.uploadCreateArguments.length = 0;
  sora2RouteState.nextRecordId = 71;
  sora2RouteState.records.length = 0;
  sora2RouteState.queueRows.length = 0;
  sora2RouteState.taskUpdates.length = 0;
  sora2RouteState.taskUpdateError = null;
  sora2RouteState.creditUpdates.length = 0;
  sora2RouteState.watchers.length = 0;
  sora2RouteState.transformError = null;
  sora2RouteState.orchestratorResult = null;
  sora2RouteState.orchestratorCalls.length = 0;
}

export async function getCurrentUser() {
  return sora2RouteState.user;
}

export function createProjectAuthProvider(getUser: typeof getCurrentUser) {
  return {
    async getCurrentUser() {
      const user = await getUser();
      return user ? { userId: user.id } : null;
    },
  };
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const fakePrisma = {
  taskData: {
    async create({ data }: { data: Record<string, unknown> }) {
      const record = { id: sora2RouteState.nextRecordId++, ...data };
      sora2RouteState.records.push(record);
      return { ...record };
    },
    async update({ where, data }: { where: { id: number }; data: Record<string, unknown> }) {
      sora2RouteState.taskUpdates.push({ where, data });
      if (sora2RouteState.taskUpdateError && "replicateId" in data) {
        throw sora2RouteState.taskUpdateError;
      }
      const record = sora2RouteState.records.find((item) => item.id === where.id);
      if (!record) throw new Error("Task not found");
      Object.assign(record, data);
      return { ...record };
    },
  },
  processingQueue: {
    async create({ data }: { data: Record<string, unknown> }) {
      sora2RouteState.queueRows.push(data);
      return { id: sora2RouteState.queueRows.length, ...data };
    },
  },
  userCredit: {
    async findFirst() {
      return { id: 5, userId: "sora-owner", credit: 100 };
    },
    async update({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      sora2RouteState.creditUpdates.push({ where, data });
      return { id: 5, credit: 93 };
    },
  },
};

export const prisma = fakePrisma;
export const db = fakePrisma;

export function createPrismaTaskRepository() {
  return {
    async create(data: Record<string, unknown>) {
      return { id: 999, model: String(data.model), status: String(data.status ?? "pending") };
    },
    async update(id: number | string, data: Record<string, unknown>) {
      sora2RouteState.taskUpdates.push({ where: { id }, data });
    },
    async findByExternalId() {
      return null;
    },
  };
}

export async function createVideoTaskWithR2Url(
  options: Record<string, unknown>,
  _deps: Record<string, unknown>,
) {
  sora2RouteState.orchestratorCalls.push(options);
  // This test double models the orchestrator's single provider submission so
  // route tests can detect an accidental second SDK/provider invocation.
  sora2RouteState.providerCreateCalls++;
  return sora2RouteState.orchestratorResult ?? {
    ok: true,
    recordId: 71,
    taskId: "runninghub-created-1",
  };
}

export function createRunningHubClient() {
  return {
    async createTaskGeneric() {
      sora2RouteState.providerCreateCalls++;
      if (sora2RouteState.providerError) throw sora2RouteState.providerError;
      return sora2RouteState.providerTaskId;
    },
    async getTaskStatus() {
      return {};
    },
    async getTaskResult() {
      return {};
    },
  };
}

export const runninghubAPI = {
  async uploadFile() {
    sora2RouteState.providerUploadCalls++;
    return "uploaded-video.mp4";
  },
  async createVideoWatermarkRemovalTask(...args: unknown[]) {
    sora2RouteState.providerCreateCalls++;
    sora2RouteState.uploadCreateArguments.push(args);
    if (sora2RouteState.providerError) throw sora2RouteState.providerError;
    return sora2RouteState.providerTaskId;
  },
};

export class TaskCreationOutcomeUnknownError extends Error {
  readonly code = "TASK_CREATION_OUTCOME_UNKNOWN";
  readonly recoverable = true;
}

export class TaskCreationRejectedError extends Error {
  readonly code = "TASK_CREATION_REJECTED";
  readonly taskWasNotCreated = true;
}

export const taskQueueManager = {
  startStatusWatcher(...args: unknown[]) {
    sora2RouteState.watchers.push(args);
  },
};

export const Credits = { "sora2-video-watermark-removal": 7 };
export const model = { sora2VideoWatermarkRemoval: "sora2-video-watermark-removal" };
export const TASK_QUEUE_CONFIG = { MAX_CONCURRENT_TASKS: 2 };
export const BillingType = { Withdraw: "Withdraw" };
export const env = {
  SORA2_UPLOAD_NODE_ID: undefined,
  SORA2_UPLOAD_FIELD_NAME: undefined,
  SORA2_LANDSCAPE_WORKFLOW_ID: "landscape-workflow",
  SORA2_PORTRAIT_WORKFLOW_ID: "portrait-workflow",
};

export async function getUserCredit() {
  return { credit: 100 };
}

export async function uploadToR2() {
  return "https://files.example.test/uploaded.mp4";
}

export async function downloadFromR2() {
  return new Uint8Array();
}

export function buildMediaTransformUrl(zoneHost: string, sourceUrl: string) {
  return `https://${zoneHost}/cdn-cgi/media/${encodeURIComponent(sourceUrl)}`;
}

export async function prewarmTransformUrl() {
  if (sora2RouteState.transformError) throw sora2RouteState.transformError;
}

export async function waitForTransformReady() {
  return true;
}

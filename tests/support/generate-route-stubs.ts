type User = { id: string } | null;

type BackgroundTask = {
  id: number;
  userId: string | null;
  principalId: string | null;
  replicateId: string;
  inputImageUrl: string;
  outputImageUrl: string | null;
  resolution: string | null;
  model: string;
  taskStatus: string;
  executeStartTime: bigint | null;
  executeEndTime: bigint | null;
  errorMsg: string | null;
  downloadCount: number;
  viewCount: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  retryCount: number;
  idempotencyKey: string | null;
};

type CountBucket = "backgroundRemovalTask" | "watermarkRemovalTask" | "objectRemovalTask" | "taskData";

export const generateRouteState = {
  user: { id: "generate-owner" } as User,
  tasks: [] as BackgroundTask[],
  nextTaskId: 1,
  providerTaskCounter: 0,
  providerCreateCalls: 0,
  providerCancelCalls: 0,
  providerError: null as Error | null,
  beforeProviderReturn: null as (() => void) | null,
  r2UploadCalls: 0,
  creditBalance: 0,
  creditReads: 0,
  creditWrites: [] as unknown[],
  quotaReads: 0,
  providerReservationStates: [] as string[],
  transactionIsolationLevels: [] as string[],
  quotaCounts: {
    backgroundRemovalTask: 0,
    watermarkRemovalTask: 0,
    objectRemovalTask: 0,
    taskData: 0,
  } as Record<CountBucket, number>,
  billingWrites: [] as unknown[],
  creditTransactionWrites: [] as unknown[],
  watcherCalls: [] as unknown[],
};

export function resetGenerateRouteState() {
  const state = generateRouteState;
  state.user = { id: "generate-owner" };
  state.tasks.length = 0;
  state.nextTaskId = 1;
  state.providerTaskCounter = 0;
  state.providerCreateCalls = 0;
  state.providerCancelCalls = 0;
  state.providerError = null;
  state.beforeProviderReturn = null;
  state.r2UploadCalls = 0;
  state.creditBalance = 0;
  state.creditReads = 0;
  state.creditWrites.length = 0;
  state.quotaReads = 0;
  state.providerReservationStates.length = 0;
  state.transactionIsolationLevels.length = 0;
  state.quotaCounts.backgroundRemovalTask = 0;
  state.quotaCounts.watermarkRemovalTask = 0;
  state.quotaCounts.objectRemovalTask = 0;
  state.quotaCounts.taskData = 0;
  state.billingWrites.length = 0;
  state.creditTransactionWrites.length = 0;
  state.watcherCalls.length = 0;
}

function matchesWhere(task: BackgroundTask, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "createdAt" && value && typeof value === "object" && "gte" in value) {
      return task.createdAt >= (value.gte as Date);
    }
    if (key === "taskStatus") {
      if (value && typeof value === "object" && "notIn" in value) {
        return !(value.notIn as string[]).includes(task.taskStatus);
      }
      if (value && typeof value === "object" && "in" in value) {
        return (value.in as string[]).includes(task.taskStatus);
      }
      return task.taskStatus === value;
    }
    return task[key as keyof BackgroundTask] === value;
  });
}

const backgroundRemovalTask = {
  count: async ({ where }: { where: Record<string, unknown> }) => {
    generateRouteState.quotaReads++;
    return generateRouteState.quotaCounts.backgroundRemovalTask + generateRouteState.tasks.filter((task) => matchesWhere(task, where)).length;
  },
  findFirst: async ({ where }: { where: Record<string, unknown> }) => {
    const task = generateRouteState.tasks.find((candidate) => matchesWhere(candidate, where));
    return task ? { ...task } : null;
  },
  create: async ({ data }: { data: Record<string, unknown> }) => {
    const now = new Date();
    const task: BackgroundTask = {
      id: generateRouteState.nextTaskId++,
      userId: (data.userId as string | null) ?? null,
      principalId: (data.principalId as string | null) ?? null,
      replicateId: String(data.replicateId),
      inputImageUrl: String(data.inputImageUrl),
      outputImageUrl: null,
      resolution: String(data.resolution ?? "1024x1024"),
      model: String(data.model),
      taskStatus: String(data.taskStatus ?? "queued"),
      executeStartTime: null,
      executeEndTime: null,
      errorMsg: null,
      downloadCount: 0,
      viewCount: 0,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      expiresAt: (data.expiresAt as Date | null) ?? null,
      retryCount: 0,
      idempotencyKey: (data.idempotencyKey as string | null) ?? null,
    };
    generateRouteState.tasks.push(task);
    return { ...task };
  },
  update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
    const task = generateRouteState.tasks.find((candidate) => candidate.id === where.id);
    if (!task) throw new Error("Task not found");
    Object.assign(task, data, { updatedAt: new Date() });
    return { ...task };
  },
  updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const task = generateRouteState.tasks.find((candidate) => matchesWhere(candidate, where));
    if (!task) return { count: 0 };
    Object.assign(task, data, { updatedAt: new Date() });
    return { count: 1 };
  },
};

function countTable(name: CountBucket) {
  return {
    count: async () => {
      generateRouteState.quotaReads++;
      return generateRouteState.quotaCounts[name];
    },
  };
}

export const generateRoutePrisma = {
  backgroundRemovalTask,
  watermarkRemovalTask: countTable("watermarkRemovalTask"),
  objectRemovalTask: countTable("objectRemovalTask"),
  taskData: countTable("taskData"),
  userBilling: {
    create: async ({ data }: { data: unknown }) => {
      generateRouteState.billingWrites.push(data);
      return data;
    },
  },
  userCreditTransaction: {
    create: async ({ data }: { data: unknown }) => {
      generateRouteState.creditTransactionWrites.push(data);
      return data;
    },
  },
  userCredit: {
    findFirst: async () => {
      generateRouteState.creditReads++;
      return { id: 8, userId: generateRouteState.user?.id, credit: generateRouteState.creditBalance };
    },
    update: async ({ data }: { data: { credit: number | { decrement?: number; increment?: number } } }) => {
      generateRouteState.creditWrites.push(data);
      generateRouteState.creditBalance = typeof data.credit === "number"
        ? data.credit
        : generateRouteState.creditBalance + (data.credit.increment || 0) - (data.credit.decrement || 0);
      return { id: 8, credit: generateRouteState.creditBalance };
    },
  },
  $transaction: async (callback: (tx: typeof generateRoutePrisma) => Promise<unknown>, options?: { isolationLevel?: string }) => {
    generateRouteState.transactionIsolationLevels.push(options?.isolationLevel || "default");
    return callback(generateRoutePrisma);
  },
};

export function getCurrentUser() {
  return Promise.resolve(generateRouteState.user);
}

export async function getUserCredit() {
  return generateRoutePrisma.userCredit.findFirst();
}

export const env = {
  R2_ACCESS_KEY: "test-access",
  R2_SECRET_KEY: "test-secret",
  R2_BUCKET: "test-bucket",
  R2_URL_BASE: "https://files.example.test",
};

export class KVRateLimit {
  constructor(..._args: unknown[]) {}
  async limit(..._args: unknown[]) {
    return { success: true };
  }
}

export const kv = {};

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createRunningHubClient() {
  return {
    createTaskGeneric: async ({ taskRecordId }: { taskRecordId: number }) => {
      generateRouteState.providerCreateCalls++;
      const task = generateRouteState.tasks.find((candidate) => candidate.id === taskRecordId);
      generateRouteState.providerReservationStates.push(task?.taskStatus || "missing");
      if (generateRouteState.providerError) throw generateRouteState.providerError;
      generateRouteState.providerTaskCounter++;
      generateRouteState.beforeProviderReturn?.();
      return `runninghub-${generateRouteState.providerTaskCounter}`;
    },
    cancelTask: async () => {
      generateRouteState.providerCancelCalls++;
    },
  };
}

export function createR2S3Service() {
  return {
    putItemInBucket: async () => {
      generateRouteState.r2UploadCalls++;
      return { completedUrl: "https://files.example.test/uploaded.png" };
    },
    getSignedUrl: async (key: string, bucket: string, expiresIn: number) =>
      `https://signed.example.test/${bucket}/${key}?expiresIn=${expiresIn}`,
  };
}

export const taskQueueManager = {
  startStatusWatcher: (...args: unknown[]) => {
    generateRouteState.watcherCalls.push(args);
  },
};

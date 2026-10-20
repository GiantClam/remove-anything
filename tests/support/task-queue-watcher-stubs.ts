export const TASK_QUEUE_CONFIG = { MAX_CONCURRENT_TASKS: 2 };

type ProviderStatusReadGate = {
  started: boolean;
  ready: Promise<void>;
  release: () => void;
};

const queuedProviderStatusReads: ProviderStatusReadGate[] = [];
const pendingProviderStatusReads = new Set<ProviderStatusReadGate>();

/** Hold the next provider read until the test explicitly permits it to finish. */
export function deferNextProviderStatusRead() {
  let resolve!: () => void;
  const ready = new Promise<void>((done) => { resolve = done; });
  const gate: ProviderStatusReadGate = {
    started: false,
    ready,
    release: () => {
      pendingProviderStatusReads.delete(gate);
      resolve();
    },
  };
  queuedProviderStatusReads.push(gate);
  pendingProviderStatusReads.add(gate);
  return gate;
}

export function releaseProviderStatusReads() {
  queuedProviderStatusReads.length = 0;
  for (const gate of pendingProviderStatusReads) gate.release();
}

type Task = {
  id: number;
  replicateId: string;
  userId: string | null;
  taskStatus: string;
  outputImageUrl: string | null;
  imageUrl: string | null;
  errorMsg: string | null;
  executeStartTime: bigint | null;
  executeEndTime: bigint | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export const watcherState = {
  background: null as Task | null,
  generic: null as Task | null,
  providerStatus: "RUNNING",
  providerOutput: "https://provider.example.test/output.png" as string | null,
  providerStatusCalls: 0,
  providerResultCalls: 0,
  activeRefreshes: 0,
  maxActiveRefreshes: 0,
  persistCalls: 0,
  persistError: false,
  beforeBackgroundUpdate: null as (() => void) | null,
  updates: 0,
  analyticsEvents: [] as AnalyticsEvent[],
};

export function resetWatcherState() {
  watcherState.background = {
    id: 17, replicateId: "watcher-background", userId: "owner", taskStatus: "processing",
    outputImageUrl: null, imageUrl: null, errorMsg: null, executeStartTime: null, executeEndTime: null,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
  };
  watcherState.generic = { ...watcherState.background, replicateId: "watcher-generic", taskStatus: "processing" };
  watcherState.providerStatus = "RUNNING";
  watcherState.providerOutput = "https://provider.example.test/output.png";
  watcherState.providerStatusCalls = 0;
  watcherState.providerResultCalls = 0;
  watcherState.activeRefreshes = 0;
  watcherState.maxActiveRefreshes = 0;
  watcherState.persistCalls = 0;
  watcherState.persistError = false;
  watcherState.beforeBackgroundUpdate = null;
  watcherState.updates = 0;
  watcherState.analyticsEvents.length = 0;
}

function matches(task: Task | null, where: Record<string, unknown>) {
  return Boolean(task && Object.entries(where).every(([key, value]) => {
    const actual = task[key as keyof Task];
    return value instanceof Date ? actual instanceof Date && actual.getTime() === value.getTime() : actual === value;
  }));
}

function model(kind: "background" | "generic") {
  return {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      const task = watcherState[kind];
      return matches(task, where) ? { ...task } : null;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      const task = watcherState[kind];
      return matches(task, where) ? { ...task } : null;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Task> }) => {
      if (kind === "background") watcherState.beforeBackgroundUpdate?.();
      watcherState.beforeBackgroundUpdate = null;
      const task = watcherState[kind];
      if (!matches(task, where)) return { count: 0 };
      Object.assign(task!, data);
      watcherState.updates++;
      return { count: 1 };
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Task> }) => {
      const task = watcherState[kind];
      if (matches(task, where)) Object.assign(task!, data);
      return task;
    },
  };
}

export const prisma = { backgroundRemovalTask: model("background"), taskData: model("generic") };

export const runninghubAPI = {
  getTaskStatus: async () => {
    watcherState.providerStatusCalls++;
    watcherState.activeRefreshes++;
    watcherState.maxActiveRefreshes = Math.max(watcherState.maxActiveRefreshes, watcherState.activeRefreshes);
    const gate = queuedProviderStatusReads.shift();
    try {
      if (gate) {
        gate.started = true;
        await gate.ready;
      }
      return { code: 0, data: { status: watcherState.providerStatus } };
    } finally {
      watcherState.activeRefreshes--;
    }
  },
  getTaskResult: async () => {
    watcherState.providerResultCalls++;
    return { code: 0, data: watcherState.providerOutput ? [{ fileUrl: watcherState.providerOutput }] : [] };
  },
};

export const taskProcessor = { processTask: async () => undefined };
export async function emitServerAnalyticsEvent(event: AnalyticsEvent) {
  watcherState.analyticsEvents.push(event);
  return event;
}
export const refundFailedTaskCredit = async () => false;
export const canRetryAutomatically = () => false;
export const normalizeTaskStatus = (value: unknown) => {
  const status = String(value || "").toLowerCase();
  if (["queued", "pending", "starting", "waiting"].includes(status)) return "queued";
  if (["processing", "running"].includes(status)) return "processing";
  if (["succeeded", "success", "completed"].includes(status)) return "succeeded";
  if (["expired", "timeout"].includes(status)) return "expired";
  return "failed";
};
export const getRunningHubLifecycleStatus = (value: unknown) => normalizeTaskStatus(value);
export const isTaskExpired = (task: { expiresAt?: Date | null }) => Boolean(task.expiresAt && task.expiresAt.getTime() <= Date.now());

export const getBackgroundTaskStatus = (task: Task) =>
  task.taskStatus === "succeeded" && !task.outputImageUrl ? "processing" : normalizeTaskStatus(task.taskStatus);

export async function refreshBackgroundTaskStatus(task: Task, isActive: () => boolean = () => true) {
  if (!isActive()) return task;
  const status = normalizeTaskStatus(task.taskStatus);
  if (!["queued", "processing"].includes(status)) return task;
  const provider = await runninghubAPI.getTaskStatus();
  let output = task.outputImageUrl;
  let nextStatus = normalizeTaskStatus(provider.data.status);
  if (nextStatus === "succeeded") {
    const result = await runninghubAPI.getTaskResult();
    const raw = result.data?.[0]?.fileUrl as string | undefined;
    if (raw) {
      watcherState.persistCalls++;
      if (watcherState.persistError) throw new Error("private persistence failed");
      output = "https://storage.example.test/background-removal/processed/private-result.png";
    } else nextStatus = "processing";
  }
  if (!isActive()) return task;
  const result = await prisma.backgroundRemovalTask.updateMany({
    where: { id: task.id, taskStatus: task.taskStatus, outputImageUrl: task.outputImageUrl, expiresAt: task.expiresAt },
    data: { taskStatus: nextStatus, outputImageUrl: output, errorMsg: null },
  });
  const persisted = await prisma.backgroundRemovalTask.findFirst({ where: { id: task.id, replicateId: task.replicateId } });
  return result.count ? persisted : persisted;
}
import type { AnalyticsEvent } from "../../lib/analytics-events";

export {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "../../lib/analytics-events";

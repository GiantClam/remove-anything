import type { AnalyticsEvent } from "../../lib/analytics-events";

export {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "../../lib/analytics-events";

type Task = {
  id: number;
  userId?: string | null;
  locale?: string | null;
  runninghubTaskId?: string | null;
  replicateId?: string | null;
  model?: string;
  taskStatus: string;
  outputImageUrl: string | null;
  outputZipUrl: string | null;
  imageUrl: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  errorMsg: string | null;
  executeEndTime?: bigint;
};

export const env = {
  RUNNINGHUB_WEBHOOK_SECRET: "test-runninghub-callback-secret-at-least-32",
  RUNNINGHUB_OUTPUT_URL_PREFIXES: "https://provider.example.test/outputs/",
  R2_URL_BASE: "https://r2.example.test/assets",
};

export const runninghubWebhookState = {
  watermark: null as Task | null,
  object: null as Task | null,
  video: null as Task | null,
  reads: 0,
  casAttempts: 0,
  transitions: 0,
  uploads: [] as Array<{
    filename: string;
    bytes: Buffer;
    options: { path: string; ContentType?: string; acl?: string };
  }>,
  stopped: [] as string[],
  analyticsEvents: [] as AnalyticsEvent[],
};

export function resetRunninghubWebhookState(
  kind: "watermark" | "object" | "video" = "object",
) {
  env.RUNNINGHUB_WEBHOOK_SECRET = "test-runninghub-callback-secret-at-least-32";
  env.RUNNINGHUB_OUTPUT_URL_PREFIXES = "https://provider.example.test/outputs/";
  const task: Task = {
    id: 23,
    userId: "owner-23",
    locale: "en",
    runninghubTaskId: "provider-23",
    replicateId: "provider-23",
    model: "sora2-video-watermark-removal",
    taskStatus: "processing",
    outputImageUrl: null,
    outputZipUrl: null,
    imageUrl: null,
    errorMsg: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  };
  Object.assign(runninghubWebhookState, {
    watermark: null,
    object: null,
    video: null,
    reads: 0,
    casAttempts: 0,
    transitions: 0,
    uploads: [],
    stopped: [],
    analyticsEvents: [],
  });
  runninghubWebhookState[kind] = task;
}

function model(kind: "watermark" | "object" | "video") {
  return {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => {
      runninghubWebhookState.reads++;
      const task = runninghubWebhookState[kind];
      return task &&
        Object.entries(where).every(
          ([key, value]) => task[key as keyof Task] === value,
        )
        ? { ...task }
        : null;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      runninghubWebhookState.reads++;
      const task = runninghubWebhookState[kind];
      return task &&
        Object.entries(where).every(
          ([key, value]) => task[key as keyof Task] === value,
        )
        ? { ...task }
        : null;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Partial<Task>;
    }) => {
      runninghubWebhookState.casAttempts++;
      const task = runninghubWebhookState[kind];
      if (
        !task ||
        !Object.entries(where).every(
          ([key, value]) => task[key as keyof Task] === value,
        )
      )
        return { count: 0 };
      Object.assign(task, data);
      runninghubWebhookState.transitions++;
      return { count: 1 };
    },
  };
}

export const prisma = {
  watermarkRemovalTask: model("watermark"),
  objectRemovalTask: model("object"),
  taskData: model("video"),
};
export const taskQueueManager = {
  stopStatusWatcher: (id: string) => {
    runninghubWebhookState.stopped.push(id);
  },
};
export async function emitServerAnalyticsEvent(event: AnalyticsEvent) {
  runninghubWebhookState.analyticsEvents.push(event);
  return event;
}
export const createR2S3Service = () => ({
  putItemInBucket: async (
    filename: string,
    bytes: Buffer,
    options: { path: string; ContentType?: string; acl?: string },
  ) => {
    runninghubWebhookState.uploads.push({ filename, bytes, options });
  },
});

export const legacyDownloadState = {
  user: null as { id: string } | null,
  task: null as any,
  taskData: null as any,
  downloaded: 0,
  signedKeys: [] as Array<{ key: string; bucket: string; expires: number }>,
  emittedEvents: [] as import("../../lib/analytics-events").AnalyticsEvent[],
  analyticsAttempts: 0,
  analyticsError: null as Error | null,
};
export {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "../../lib/analytics-events";
export const env = {
  R2_URL_BASE: "https://files.test/bucket",
  R2_BUCKET: "private-test-bucket",
};
export function createR2S3Service() {
  return {
    getSignedUrl: async (key: string, bucket: string, expires: number) => {
      legacyDownloadState.signedKeys.push({ key, bucket, expires });
      return `https://signed-files.test/${key}`;
    },
  };
}
export const kv = {};
export const prisma = {
  watermarkRemovalTask: { findUnique: async () => legacyDownloadState.task },
  taskData: {
    findFirst: async ({ where }: { where?: { model?: string } }) =>
      where?.model === "sora2-video-watermark-removal"
        ? legacyDownloadState.taskData
        : null,
    findUnique: async () => legacyDownloadState.taskData,
  },
};
export class KVRateLimit {
  async limit() {
    return { success: true };
  }
}
export function isCloudflareRequest() {
  return false;
}
export function createBindingsFromRequest() {
  throw new Error("Unexpected Cloudflare request");
}
export function Hashids() {
  return { decode: () => [17] };
}
export async function getCurrentUser() {
  return legacyDownloadState.user;
}
export async function findBackgroundRemovalTaskByReplicateId() {
  return legacyDownloadState.task;
}
export async function incrementDownloadCount() {
  legacyDownloadState.downloaded++;
}
export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Download failed";
}
export async function emitServerAnalyticsEvent(
  event: import("../../lib/analytics-events").AnalyticsEvent,
) {
  legacyDownloadState.analyticsAttempts++;
  if (legacyDownloadState.analyticsError) throw legacyDownloadState.analyticsError;
  legacyDownloadState.emittedEvents.push(event);
  return event;
}

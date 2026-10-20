import type { AnalyticsEvent } from "../../lib/analytics-events";

export {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "../../lib/analytics-events";

export type DownloadTask = {
  id: number;
  userId?: string | null;
  principalId?: string | null;
  taskStatus: string;
  outputImageUrl: string | null;
  expiresAt?: Date | null;
  createdAt?: Date | null;
};

export const env = {
  R2_URL_BASE: "https://files.example.test/assets",
  R2_BUCKET: "unit-test-bucket",
};

export const downloadRouteState = {
  user: null as { id: string } | null,
  task: null as DownloadTask | null,
  lookupIds: [] as string[],
  signedRequests: [] as { key: string; bucket?: string; expiresIn?: number }[],
  signedUrl: "https://signed-storage.example.test/result?signature=test",
  emittedEvents: [] as AnalyticsEvent[],
  signError: null as Error | null,
  emitError: null as Error | null,
};

export function resetDownloadRouteState() {
  downloadRouteState.user = null;
  downloadRouteState.task = null;
  downloadRouteState.lookupIds.length = 0;
  downloadRouteState.signedRequests.length = 0;
  downloadRouteState.emittedEvents.length = 0;
  downloadRouteState.signError = null;
  downloadRouteState.emitError = null;
}

export async function findObjectRemovalTaskByRunningHubId(taskId: string) {
  downloadRouteState.lookupIds.push(taskId);
  return downloadRouteState.task;
}

export async function getCurrentUser() {
  return downloadRouteState.user;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export function createR2S3Service() {
  return {
    getSignedUrl: async (key: string, bucket?: string, expiresIn?: number) => {
      downloadRouteState.signedRequests.push({ key, bucket, expiresIn });
      if (downloadRouteState.signError) throw downloadRouteState.signError;
      return downloadRouteState.signedUrl;
    },
  };
}

export async function emitServerAnalyticsEvent(event: AnalyticsEvent) {
  downloadRouteState.emittedEvents.push(event);
  if (downloadRouteState.emitError) throw downloadRouteState.emitError;
  return event;
}

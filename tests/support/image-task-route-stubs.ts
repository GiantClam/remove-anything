export const imageTaskRouteState = {
  user: null as { id: string } | null,
  providerError: null as Error | null,
  providerCreateCalls: 0,
  providerCancelCalls: 0,
  uploadError: null as Error | null,
  uploadCalls: 0,
  updateCalls: [] as unknown[],
};
export function resetImageTaskRouteState() {
  imageTaskRouteState.user = null;
  imageTaskRouteState.providerError = null;
  imageTaskRouteState.providerCreateCalls = 0;
  imageTaskRouteState.providerCancelCalls = 0;
  imageTaskRouteState.uploadError = null;
  imageTaskRouteState.uploadCalls = 0;
  imageTaskRouteState.updateCalls.length = 0;
}
export async function getCurrentUser() { return imageTaskRouteState.user; }
export function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
export const runninghubAPI = {
  uploadZip: async () => {
    imageTaskRouteState.uploadCalls++;
    if (imageTaskRouteState.uploadError) throw imageTaskRouteState.uploadError;
    return "uploaded.zip";
  },
  createWatermarkRemovalTask: async () => {
    imageTaskRouteState.providerCreateCalls++;
    if (imageTaskRouteState.providerError) throw imageTaskRouteState.providerError;
    return `watermark-${imageTaskRouteState.providerCreateCalls}`;
  },
  createObjectRemoveTask: async () => {
    imageTaskRouteState.providerCreateCalls++;
    if (imageTaskRouteState.providerError) throw imageTaskRouteState.providerError;
    return `object-${imageTaskRouteState.providerCreateCalls}`;
  },
  cancelTask: async () => { imageTaskRouteState.providerCancelCalls++; },
};
export async function uploadToR2() {
  imageTaskRouteState.uploadCalls++;
  if (imageTaskRouteState.uploadError) throw imageTaskRouteState.uploadError;
  return "https://files.example.test/input.zip";
}
export async function updateWatermarkRemovalTask(taskId: number, data: unknown) {
  imageTaskRouteState.updateCalls.push({ taskId, data });
  return (globalThis as any).__TEST_PRISMA__.watermarkRemovalTask.update({ where: { id: taskId }, data });
}
export async function updateObjectRemovalTask(taskId: number, data: unknown) {
  imageTaskRouteState.updateCalls.push({ taskId, data });
  return (globalThis as any).__TEST_PRISMA__.objectRemovalTask.update({ where: { id: taskId }, data });
}
export function buildRemoveNodeInfoList() { return []; }

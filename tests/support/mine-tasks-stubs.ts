export const env = {
  R2_URL_BASE: "https://files.example.test",
};

export const mineTasksState = {
  user: { id: "owner" } as { id: string } | null,
  taskData: [] as any[],
  backgroundRemovalTask: [] as any[],
  watermarkRemovalTask: [] as any[],
};

export function resetMineTasksState() {
  mineTasksState.user = { id: "owner" };
  mineTasksState.taskData = [];
  mineTasksState.backgroundRemovalTask = [];
  mineTasksState.watermarkRemovalTask = [];
}

export async function getCurrentUser() {
  return mineTasksState.user;
}

export function shouldSkipDatabaseQuery() {
  return false;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export const prisma = {
  taskData: {
    findMany: async () => mineTasksState.taskData,
    count: async () => mineTasksState.taskData.length,
  },
  backgroundRemovalTask: {
    findMany: async () => mineTasksState.backgroundRemovalTask,
  },
  watermarkRemovalTask: {
    findMany: async () => mineTasksState.watermarkRemovalTask,
  },
};

export function normalizeTaskStatus(value: unknown) {
  const status = String(value || "").toLowerCase();
  if (["queued", "pending", "starting", "waiting"].includes(status))
    return "queued";
  if (["processing", "running", "in_progress", "in-progress"].includes(status))
    return "processing";
  if (
    ["succeeded", "success", "completed", "complete", "done"].includes(status)
  )
    return "succeeded";
  if (["expired", "timeout", "timed_out"].includes(status)) return "expired";
  return "failed";
}

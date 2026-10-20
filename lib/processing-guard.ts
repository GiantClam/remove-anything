import { TASK_QUEUE_CONFIG } from "@/config/constants";

/** Shared in-process capacity key for the synchronous object geometry steps. */
export const OBJECT_GEOMETRY_PROCESSING_KEY = "remove-objects-geometry";

export class ProcessingTimeoutError extends Error {
  readonly code = "PROCESSING_TIMEOUT" as const;

  constructor() {
    super("Processing exceeded its declared timeout");
    this.name = "ProcessingTimeoutError";
  }
}

type ProcessingLease = {
  release(): void;
};

const activeLeases = new Map<string, number>();

/**
 * Reserve a bounded local processing slot without waiting indefinitely.
 *
 * This protects synchronous provider submissions from a request burst. The
 * durable queue and provider-side concurrency still need integration checks;
 * this guard only makes the application boundary fail closed locally.
 */
export function acquireProcessingLease(
  key: string,
  maxConcurrent = TASK_QUEUE_CONFIG.MAX_CONCURRENT_TASKS,
): ProcessingLease | null {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent <= 0) {
    throw new Error("Invalid processing concurrency limit");
  }

  const active = activeLeases.get(key) ?? 0;
  if (active >= maxConcurrent) return null;
  activeLeases.set(key, active + 1);

  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      const next = (activeLeases.get(key) ?? 1) - 1;
      if (next <= 0) activeLeases.delete(key);
      else activeLeases.set(key, next);
    },
  };
}

export function getActiveProcessingCount(key: string) {
  return activeLeases.get(key) ?? 0;
}

/** Race provider work against the remaining declared request deadline. */
export async function runWithinProcessingDeadline<T>(
  work: () => Promise<T>,
  deadline: number,
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new ProcessingTimeoutError();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new ProcessingTimeoutError()),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sleepUntilProcessingDeadline(
  deadline: number,
  intervalMs: number,
): Promise<boolean> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return false;
  await new Promise((resolve) =>
    setTimeout(resolve, Math.min(intervalMs, remaining)),
  );
  return Date.now() < deadline;
}

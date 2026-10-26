import assert from "node:assert/strict";
import test from "node:test";

import { waitForTransformReady } from "../../lib/cf-media";
import {
  claimVideoQueueItem,
  createTaskProcessorInput,
  dispatchVideoQueueItem,
  enqueueSora2VideoQueueItem,
  getQueuedTaskRecordId,
  getSora2SubmissionDisposition,
  getUnknownVideoSubmissionCode,
  getUnknownVideoSubmissionUpdatedAt,
  getVideoQueueTransformWaitBudget,
  hasVideoQueueTaskBudget,
  QueueDeadlineExceededError,
  recoverStaleVideoQueueItemInTransaction,
  recoverStaleVideoQueueItems,
  resolveSora2VideoQueueMetadata,
  SORA2_VIDEO_WATERMARK_TASK_TYPE,
  TransformReadinessQueueError,
  VIDEO_QUEUE_RECONCILIATION_REQUIRED_CODE,
  VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR,
  type ProcessingQueueUpdate,
} from "../../lib/video-task-queue-contract";
import { createVideoTaskWithR2Url } from "../../modules/tasks/sdk";

const currentTaskType = SORA2_VIDEO_WATERMARK_TASK_TYPE;

test("persistent queue dispatch preserves an SDK retry's workflow and node inputs", () => {
  const input = createTaskProcessorInput({
    id: 17,
    taskType: "video-watermark-removal",
    payload: {
      taskRecordId: 42,
      userId: "user-1",
      model: currentTaskType,
      workflowId: "workflow-selected-at-request-time",
      r2Url: "https://media.example.test/source.mp4",
      nodeInfoList: [
        {
          nodeId: "153",
          fieldName: "video",
          fieldValue: "https://media.example.test/transformed.mp4",
        },
      ],
    },
  });

  assert.deepEqual(input, {
    id: "cron_17",
    taskType: currentTaskType,
    metadata: {
      taskRecordId: 42,
      userId: "user-1",
      model: currentTaskType,
      workflowId: "workflow-selected-at-request-time",
      r2Url: "https://media.example.test/source.mp4",
      nodeInfoList: [
        {
          nodeId: "153",
          fieldName: "video",
          fieldValue: "https://media.example.test/transformed.mp4",
        },
      ],
    },
  });
});

test("persistent queue dispatch accepts current URL-route payloads", () => {
  assert.deepEqual(
    createTaskProcessorInput({
      id: 18,
      taskType: currentTaskType,
      payload: {
        taskRecordId: 43,
        userId: "user-2",
        orientation: "portrait",
        r2Url: "https://media.example.test/input.mp4",
      },
    }),
    {
      id: "cron_18",
      taskType: currentTaskType,
      metadata: {
        taskRecordId: 43,
        userId: "user-2",
        orientation: "portrait",
        r2Url: "https://media.example.test/input.mp4",
      },
    },
  );
});

test("persistent dispatch rejects unknown queue types instead of completing them", async () => {
  const updates: Array<{ status: string; lastError?: string }> = [];
  let processCalls = 0;
  const outcome = await dispatchVideoQueueItem(
    { id: 19, taskType: "some-unhandled-type", payload: {} },
    {
      lease: {
        claimedAt: new Date("2026-10-21T00:00:00.000Z"),
        taskType: "some-unhandled-type",
        scheduledAt: new Date("2026-10-21T00:00:00.000Z"),
        retryCount: 0,
      },
      async updateQueueItem(_id, data) {
        updates.push(data);
        return true;
      },
      async processSora2VideoWatermarkRemoval() {
        processCalls++;
      },
    },
  );

  assert.equal(outcome, "failed");
  assert.equal(processCalls, 0);
  assert.equal(updates[0]?.status, "failed");
  assert.match(
    updates[0]?.lastError ?? "",
    /Unsupported processing queue task type/,
  );
});

test("cron dispatcher permits one typed pre-provider retry and then fails", async () => {
  const updates: ProcessingQueueUpdate[] = [];
  let processCalls = 0;
  const process = async () => {
    processCalls++;
    throw new TransformReadinessQueueError("transform not ready");
  };
  const deps = {
    lease: {
      claimedAt: new Date("2026-10-21T00:00:00.000Z"),
      taskType: currentTaskType,
      scheduledAt: new Date("2026-10-21T00:00:00.000Z"),
      retryCount: 0,
    },
    async updateQueueItem(_id, data) {
      updates.push(data);
      return true;
    },
    processSora2VideoWatermarkRemoval: process,
    now: () => 1_000,
  };

  assert.equal(
    await dispatchVideoQueueItem(
      { id: 20, taskType: currentTaskType, payload: {}, retryCount: 0 },
      deps,
    ),
    "retrying",
  );
  assert.deepEqual(updates[0], {
    status: "pending",
    retryCount: 1,
    lastError: "transform not ready",
    scheduledAt: new Date(61_000),
  });

  assert.equal(
    await dispatchVideoQueueItem(
      { id: 20, taskType: currentTaskType, payload: {}, retryCount: 1 },
      deps,
    ),
    "failed",
  );
  assert.equal(processCalls, 2);
  assert.equal(updates[1]?.status, "failed");
});

test("unknown provider creation outcome fails queue row without replay", async () => {
  const updates: ProcessingQueueUpdate[] = [];
  let processCalls = 0;
  const outcome = await dispatchVideoQueueItem(
    { id: 21, taskType: currentTaskType, payload: { taskRecordId: 5 } },
    {
      lease: {
        claimedAt: new Date("2026-10-21T00:00:00.000Z"),
        taskType: currentTaskType,
        scheduledAt: new Date("2026-10-21T00:00:00.000Z"),
        retryCount: 0,
      },
      async updateQueueItem(_id, data) {
        updates.push(data);
        return true;
      },
      async processSora2VideoWatermarkRemoval() {
        processCalls++;
        throw Object.assign(new Error("outcome unknown"), {
          code: "TASK_CREATION_OUTCOME_UNKNOWN",
        });
      },
    },
  );

  assert.equal(outcome, "failed");
  assert.equal(processCalls, 1);
  assert.equal(updates[0]?.status, "failed");
  assert.equal("retryCount" in (updates[0] ?? {}), false);
});

test("a lost queue lease fences off late worker completion", async () => {
  const claimedAt = new Date("2026-10-21T00:00:00.000Z");
  const lease = {
    claimedAt,
    taskType: currentTaskType,
    scheduledAt: new Date("2026-10-21T00:00:00.000Z"),
    retryCount: 0,
  };
  let processCalls = 0;
  const outcome = await dispatchVideoQueueItem(
    { id: 26, taskType: currentTaskType, payload: {} },
    {
      lease,
      async updateQueueItem(_id, _data, observedLease) {
        assert.equal(observedLease, lease);
        return false;
      },
      async processSora2VideoWatermarkRemoval() {
        processCalls++;
      },
    },
  );

  assert.equal(outcome, "lease-lost");
  assert.equal(processCalls, 1);
});

test("repeated deadline failures become terminal after one safe retry", async () => {
  const updates: ProcessingQueueUpdate[] = [];
  let processCalls = 0;
  const deps = {
    lease: {
      claimedAt: new Date("2026-10-21T00:00:00.000Z"),
      taskType: currentTaskType,
      scheduledAt: new Date("2026-10-21T00:00:00.000Z"),
      retryCount: 0,
    },
    now: () => 1_000,
    async updateQueueItem(_id, data) {
      updates.push(data);
      return true;
    },
    async processSora2VideoWatermarkRemoval() {
      processCalls++;
      throw new QueueDeadlineExceededError("budget exhausted");
    },
  };

  assert.equal(
    await dispatchVideoQueueItem(
      { id: 27, taskType: currentTaskType, payload: {}, retryCount: 0 },
      deps,
    ),
    "retrying",
  );
  assert.deepEqual(updates[0], {
    status: "pending",
    retryCount: 1,
    lastError: "budget exhausted",
    scheduledAt: new Date(61_000),
  });

  assert.equal(
    await dispatchVideoQueueItem(
      { id: 27, taskType: currentTaskType, payload: {}, retryCount: 1 },
      deps,
    ),
    "failed",
  );
  assert.equal(processCalls, 2);
  assert.equal(updates[1]?.status, "failed");
  assert.equal(
    updates.some(
      (update) => update.status === "pending" && update.retryCount === 2,
    ),
    false,
  );
});

test("invalid retry counters fail closed without granting another retry", async () => {
  const updates: ProcessingQueueUpdate[] = [];
  let processCalls = 0;
  const outcome = await dispatchVideoQueueItem(
    { id: 28, taskType: currentTaskType, payload: {}, retryCount: -1 },
    {
      lease: {
        claimedAt: new Date("2026-10-21T00:00:00.000Z"),
        taskType: currentTaskType,
        scheduledAt: new Date("2026-10-21T00:00:00.000Z"),
        retryCount: -1,
      },
      async updateQueueItem(_id, data) {
        updates.push(data);
        return true;
      },
      async processSora2VideoWatermarkRemoval() {
        processCalls++;
        throw new QueueDeadlineExceededError("budget exhausted");
      },
    },
  );

  assert.equal(outcome, "failed");
  assert.equal(processCalls, 1);
  assert.equal(updates[0]?.status, "failed");
});

test("transform readiness polling aborts at its deadline", async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  let signal: AbortSignal | undefined;
  AbortSignal.timeout = ((timeoutMs: number) => {
    const controller = new AbortController();
    setTimeout(
      () => controller.abort(new Error("request timed out")),
      timeoutMs,
    );
    return controller.signal;
  }) as typeof AbortSignal.timeout;
  globalThis.fetch = async (_input, init) => {
    signal = init?.signal as AbortSignal;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(signal?.reason), {
        once: true,
      });
    });
  };

  try {
    const startedAt = Date.now();
    assert.equal(
      await waitForTransformReady("https://media.example.test/video.mp4", {
        timeoutMs: 25,
        intervalMs: 1,
      }),
      false,
    );
    assert.ok(Date.now() - startedAt < 500);
    assert.ok(signal?.aborted);
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  }
});

test("video queue time budgets preserve provider time and reject expired work", () => {
  const now = 10_000;
  const deadlineAt = now + 45_000;

  assert.equal(hasVideoQueueTaskBudget(deadlineAt, now), true);
  assert.equal(getVideoQueueTransformWaitBudget(deadlineAt, now), 12_000);
  assert.equal(hasVideoQueueTaskBudget(now + 32_999, now), false);
  assert.equal(getVideoQueueTransformWaitBudget(now + 32_999, now), -1);
});

test("Sora2 metadata waits only for a transform on the configured R2 host", () => {
  const direct = resolveSora2VideoQueueMetadata(
    {
      taskRecordId: 42,
      workflowId: "workflow-1",
      r2Url: "https://outside.example.test/video.mp4",
    },
    {},
  );
  assert.equal(direct.transformUrl, "https://outside.example.test/video.mp4");
  assert.equal(direct.shouldWaitForTransform, false);

  const generatedTransform = resolveSora2VideoQueueMetadata(
    {
      taskRecordId: 43,
      workflowId: "workflow-1",
      r2Url: "https://s.remove-anything.com/video.mp4",
    },
    {},
  );
  assert.equal(generatedTransform.shouldWaitForTransform, true);
  assert.match(generatedTransform.transformUrl, /cdn-cgi\/media/);
});

test("R2 prewarm failure payload is durably enqueued with its retry inputs", async () => {
  const writes: Array<Record<string, unknown>> = [];
  await enqueueSora2VideoQueueItem(
    {
      async create(args) {
        writes.push(args.data);
      },
    },
    {
      payload: {
        taskRecordId: 44,
        userId: "user-4",
        orientation: "landscape",
        r2Url: "https://s.remove-anything.com/source.mp4",
        transformUrl: "https://s.remove-anything.com/cdn-cgi/media/source.mp4",
      },
      lastError: "transform prewarm failed",
    },
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.taskType, currentTaskType);
  assert.equal(writes[0]?.status, "pending");
  assert.equal(writes[0]?.retryCount, 0);
  assert.equal(writes[0]?.lastError, "transform prewarm failed");
  assert.deepEqual(writes[0]?.payload, {
    taskRecordId: 44,
    userId: "user-4",
    orientation: "landscape",
    r2Url: "https://s.remove-anything.com/source.mp4",
    transformUrl: "https://s.remove-anything.com/cdn-cgi/media/source.mp4",
  });
});

test("queue claim compares the selected snapshot and a fresh due-time cutoff", async () => {
  const observed: unknown[] = [];
  const updateMany = async (args: unknown) => {
    observed.push(args);
    return { count: 1 };
  };
  const scheduledAt = new Date("2026-10-19T00:00:00.000Z");
  const freshNow = new Date("2026-10-19T00:01:00.000Z");

  const claimedAt = await claimVideoQueueItem(
    { id: 22, taskType: currentTaskType, scheduledAt, retryCount: 0 },
    updateMany,
    () => freshNow,
  );
  assert.equal(claimedAt, freshNow);
  assert.deepEqual(observed[0], {
    where: {
      id: 22,
      taskType: currentTaskType,
      status: "pending",
      retryCount: 0,
      scheduledAt: { equals: scheduledAt, lte: freshNow },
    },
    data: { status: "running", updatedAt: freshNow },
  });
});

test("queue claim rejects stale schedule and retry-count snapshots", async (t) => {
  const snapshotScheduledAt = new Date("2026-10-19T00:00:00.000Z");
  const freshNow = new Date("2026-10-19T00:01:00.000Z");
  const snapshot = {
    id: 23,
    taskType: currentTaskType,
    scheduledAt: snapshotScheduledAt,
    retryCount: 0,
  };

  for (const scenario of [
    {
      name: "the row was rescheduled",
      currentScheduledAt: new Date("2026-10-19T00:00:30.000Z"),
      currentRetryCount: 0,
    },
    {
      name: "the row retry count advanced",
      currentScheduledAt: snapshotScheduledAt,
      currentRetryCount: 1,
    },
  ]) {
    await t.test(scenario.name, async () => {
      const claimedAt = await claimVideoQueueItem(
        snapshot,
        async ({ where }) => ({
          count:
            where.id === snapshot.id &&
            where.status === "pending" &&
            where.retryCount === scenario.currentRetryCount &&
            where.scheduledAt.equals.getTime() ===
              scenario.currentScheduledAt.getTime() &&
            scenario.currentScheduledAt.getTime() <=
              where.scheduledAt.lte.getTime()
              ? 1
              : 0,
        }),
        () => freshNow,
      );

      assert.equal(claimedAt, null);
    });
  }
});

test("queue claim cannot claim a pending item before its fresh due-time cutoff", async () => {
  const scheduledAt = new Date("2026-10-19T00:05:00.000Z");
  const freshNow = new Date("2026-10-19T00:01:00.000Z");
  let observedDueCutoff: Date | undefined;

  const claimedAt = await claimVideoQueueItem(
    { id: 24, taskType: currentTaskType, scheduledAt, retryCount: 1 },
    async ({ where }) => {
      observedDueCutoff = where.scheduledAt.lte;
      return {
        count:
          where.scheduledAt.equals.getTime() === scheduledAt.getTime() &&
          scheduledAt.getTime() <= where.scheduledAt.lte.getTime()
            ? 1
            : 0,
      };
    },
    () => freshNow,
  );

  assert.equal(claimedAt, null);
  assert.equal(observedDueCutoff, freshNow);
});

test("overlapping cron claims can win a pending row only once", async () => {
  let row = {
    id: 25,
    taskType: currentTaskType,
    status: "pending",
    retryCount: 0,
    scheduledAt: new Date("2026-10-19T00:00:00.000Z"),
    updatedAt: new Date("2026-10-19T00:00:00.000Z"),
  };
  const updateMany = async ({ where, data }: any) => {
    if (
      row.id !== where.id ||
      row.taskType !== where.taskType ||
      row.status !== where.status ||
      row.retryCount !== where.retryCount ||
      row.scheduledAt.getTime() !== where.scheduledAt.equals.getTime() ||
      row.scheduledAt.getTime() > where.scheduledAt.lte.getTime()
    ) {
      return { count: 0 };
    }
    row = { ...row, ...data };
    return { count: 1 };
  };
  const scheduledAt = row.scheduledAt;
  const [first, second] = await Promise.all([
    claimVideoQueueItem(
      { id: 25, taskType: currentTaskType, scheduledAt, retryCount: 0 },
      updateMany,
      () => new Date("2026-10-19T00:01:00.000Z"),
    ),
    claimVideoQueueItem(
      { id: 25, taskType: currentTaskType, scheduledAt, retryCount: 0 },
      updateMany,
      () => new Date("2026-10-19T00:01:01.000Z"),
    ),
  ]);

  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal(row.status, "running");
});

test("stale video queue recovery is bounded, compare-and-set, and never requeues", async () => {
  const now = new Date("2026-10-21T00:10:00.000Z");
  const staleUpdatedAt = new Date("2026-10-21T00:07:00.000Z");
  const candidates = [
    {
      id: 31,
      taskType: currentTaskType,
      payload: { taskRecordId: 901 },
      updatedAt: staleUpdatedAt,
    },
    {
      id: 32,
      taskType: currentTaskType,
      payload: { taskRecordId: 902 },
      updatedAt: staleUpdatedAt,
    },
  ];
  const queries: unknown[] = [];
  const reconciled: number[] = [];

  const recovered = await recoverStaleVideoQueueItems(
    async (args) => {
      queries.push(args);
      return candidates;
    },
    async (item) => {
      // Simulate an overlapping worker winning the CAS for row 32.
      if (item.id !== 31) return false;
      reconciled.push(Number(item.payload?.taskRecordId));
      return true;
    },
    () => now,
  );

  assert.equal(recovered, 1);
  assert.deepEqual(queries[0], {
    where: {
      status: "running",
      OR: [
        { taskType: currentTaskType },
        {
          taskType: "video-watermark-removal",
          payload: { path: ["model"], equals: currentTaskType },
        },
      ],
      updatedAt: { lt: new Date("2026-10-21T00:08:00.000Z") },
    },
    orderBy: { updatedAt: "asc" },
    take: 20,
    select: { id: true, taskType: true, payload: true, updatedAt: true },
  });
  assert.deepEqual(reconciled, [901]);
  assert.deepEqual(
    candidates.map((item) => item.id),
    [31, 32],
  );
});

test("stale lease recovery atomically fences the queue row and marks only an unlinked live task", async () => {
  const now = new Date("2026-10-21T00:10:00.000Z");
  const item = {
    id: 41,
    taskType: currentTaskType,
    payload: { taskRecordId: "77" },
    updatedAt: new Date("2026-10-21T00:07:00.000Z"),
  };
  const writes: Array<{ model: string; args: unknown }> = [];
  const transaction = {
    processingQueue: {
      async updateMany(args: unknown) {
        writes.push({ model: "queue", args });
        return { count: 1 };
      },
    },
    taskData: {
      async updateMany(args: unknown) {
        writes.push({ model: "task", args });
        return { count: 1 };
      },
    },
  };

  assert.equal(
    await recoverStaleVideoQueueItemInTransaction(
      transaction,
      item,
      new Date(now.getTime() - 120_000),
      now,
    ),
    true,
  );
  assert.deepEqual(
    writes.map((write) => write.model),
    ["queue", "task"],
  );
  assert.deepEqual(writes[0]?.args, {
    where: {
      AND: [
        {
          OR: [
            { taskType: currentTaskType },
            {
              taskType: "video-watermark-removal",
              payload: { path: ["model"], equals: currentTaskType },
            },
          ],
        },
        {
          id: 41,
          taskType: currentTaskType,
          status: "running",
        },
        {
          updatedAt: {
            equals: item.updatedAt,
            lt: new Date("2026-10-21T00:08:00.000Z"),
          },
        },
      ],
    },
    data: {
      status: "failed",
      lastError: VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR,
    },
  });
  assert.deepEqual(writes[1]?.args, {
    where: {
      id: 77,
      model: currentTaskType,
      replicateId: null,
      taskStatus: {
        in: [
          "pending",
          "Pending",
          "queued",
          "Queued",
          "starting",
          "Starting",
          "processing",
          "Processing",
          "running",
          "RUNNING",
        ],
      },
    },
    data: {
      taskStatus: "Processing",
      errorMsg: VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR,
      updatedAt: now,
    },
  });
  assert.equal(getQueuedTaskRecordId({ taskRecordId: "77" }), 77);
  assert.equal(getQueuedTaskRecordId({ taskRecordId: "1.5" }), null);
  assert.equal(
    getUnknownVideoSubmissionCode(VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR),
    VIDEO_QUEUE_RECONCILIATION_REQUIRED_CODE,
  );
  assert.equal(
    getUnknownVideoSubmissionCode("TASK_CREATION_OUTCOME_UNKNOWN: timeout"),
    "TASK_CREATION_OUTCOME_UNKNOWN",
  );
  assert.equal(getUnknownVideoSubmissionCode("ordinary error"), null);
  assert.equal(
    getUnknownVideoSubmissionUpdatedAt(
      VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR,
      new Date("2026-10-20T00:00:00.000Z"),
      new Date("2026-10-21T00:07:00.000Z"),
    ).toISOString(),
    "2026-10-21T00:07:00.000Z",
  );
});

test("stale lease recovery does not reconcile a queue row after its CAS is lost", async () => {
  const writes: string[] = [];
  const updated = await recoverStaleVideoQueueItemInTransaction(
    {
      processingQueue: {
        async updateMany() {
          writes.push("queue");
          return { count: 0 };
        },
      },
      taskData: {
        async updateMany() {
          writes.push("task");
          return { count: 1 };
        },
      },
    },
    {
      id: 42,
      taskType: currentTaskType,
      payload: { taskRecordId: 77 },
      updatedAt: new Date("2026-10-21T00:07:00.000Z"),
    },
    new Date("2026-10-21T00:08:00.000Z"),
  );

  assert.equal(updated, false);
  assert.deepEqual(writes, ["queue"]);
});

test("provider submission failures do not enqueue and never shape as queued", async () => {
  const queued: Array<{ taskType: string; payload: Record<string, any> }> = [];
  const statuses: string[] = [];
  const result = await createVideoTaskWithR2Url(
    {
      model: currentTaskType,
      userId: "user-3",
      workflowId: "workflow-3",
      uploadNodeId: "205",
      r2Url: "https://media.example.test/transformed.mp4",
    },
    {
      repo: {
        async create(data) {
          return {
            id: 44,
            userId: data.userId,
            model: data.model,
            status: data.status ?? "pending",
          };
        },
        async update(_id, data) {
          statuses.push(String(data.status));
        },
        async findByExternalId() {
          return null;
        },
      },
      queue: {
        async enqueue(taskType, payload) {
          queued.push({ taskType, payload });
        },
      },
      rh: {
        async createTaskGeneric() {
          throw Object.assign(new Error("transport timed out"), {
            code: "TASK_CREATION_OUTCOME_UNKNOWN",
          });
        },
        async getTaskStatus() {
          return {};
        },
        async getTaskResult() {
          return {};
        },
      },
    },
  );

  const disposition = getSora2SubmissionDisposition(result);
  assert.equal(disposition.accepted, true);
  assert.equal(disposition.status, "submission-unknown");
  assert.notEqual(disposition.status, "queued");
  assert.deepEqual(queued, []);
  assert.deepEqual(statuses, ["processing"]);
});

test("explicit provider rejection is failed and remains distinct from unknown outcome", async () => {
  const disposition = getSora2SubmissionDisposition({
    ok: false,
    recordId: 45,
    error: "TASK_QUEUE_MAXED",
    submissionOutcome: "rejected",
  });
  assert.equal(disposition.accepted, false);
  assert.equal(disposition.status, "failed");
});

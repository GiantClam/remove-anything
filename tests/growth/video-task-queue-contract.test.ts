import assert from "node:assert/strict";
import test from "node:test";

import {
  claimVideoQueueItem,
  createTaskProcessorInput,
  dispatchVideoQueueItem,
  enqueueSora2VideoQueueItem,
  getSora2SubmissionDisposition,
  resolveSora2VideoQueueMetadata,
  SORA2_VIDEO_WATERMARK_TASK_TYPE,
  TransformReadinessQueueError,
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
      async updateQueueItem(_id, data) {
        updates.push(data);
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
    async updateQueueItem(_id, data) {
      updates.push(data);
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
      async updateQueueItem(_id, data) {
        updates.push(data);
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

  assert.equal(
    await claimVideoQueueItem(
      { id: 22, scheduledAt, retryCount: 0 },
      updateMany,
      () => freshNow,
    ),
    true,
  );
  assert.deepEqual(observed[0], {
    where: {
      id: 22,
      status: "pending",
      retryCount: 0,
      scheduledAt: { equals: scheduledAt, lte: freshNow },
    },
    data: { status: "running" },
  });
});

test("queue claim rejects stale schedule and retry-count snapshots", async (t) => {
  const snapshotScheduledAt = new Date("2026-10-19T00:00:00.000Z");
  const freshNow = new Date("2026-10-19T00:01:00.000Z");
  const snapshot = { id: 23, scheduledAt: snapshotScheduledAt, retryCount: 0 };

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
      const claimed = await claimVideoQueueItem(
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

      assert.equal(claimed, false);
    });
  }
});

test("queue claim cannot claim a pending item before its fresh due-time cutoff", async () => {
  const scheduledAt = new Date("2026-10-19T00:05:00.000Z");
  const freshNow = new Date("2026-10-19T00:01:00.000Z");
  let observedDueCutoff: Date | undefined;

  const claimed = await claimVideoQueueItem(
    { id: 24, scheduledAt, retryCount: 1 },
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

  assert.equal(claimed, false);
  assert.equal(observedDueCutoff, freshNow);
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

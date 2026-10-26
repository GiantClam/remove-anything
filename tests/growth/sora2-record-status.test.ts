import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test from "node:test";

import { VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR } from "../../lib/video-task-queue-contract";
import {
  recordStatusState,
  resetRecordStatusState,
} from "../support/sora2-record-status-stubs";

const routePromise = import(
  "../../app/api/sora2-video-watermark-removal-by-id/[id]/route"
);

test("record status surfaces stale provider outcomes for reconciliation without polling or replay", async () => {
  const createdAt = new Date("2026-10-20T00:00:00.000Z");
  const updatedAt = new Date("2026-10-21T00:07:00.000Z");
  resetRecordStatusState({
    id: 77,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "Processing",
    replicateId: null,
    imageUrl: null,
    errorMsg: VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR,
    createdAt,
    updatedAt,
    executeStartTime: null,
    executeEndTime: null,
    user: null,
  });

  const { GET } = await routePromise;
  const response = await GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-by-id/77",
    ),
    { params: { id: "77" } },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "submission-unknown");
  assert.equal(body.code, "VIDEO_QUEUE_RECONCILIATION_REQUIRED");
  assert.equal(body.createdAt, updatedAt.toISOString());
  assert.equal(body.runninghubTaskId, null);
  assert.equal(body.errorMsg, VIDEO_QUEUE_STALE_OUTCOME_UNKNOWN_ERROR);
  assert.equal(recordStatusState.providerStatusCalls, 0);
  assert.equal(recordStatusState.providerResultCalls, 0);
});

test("record status retains the legacy outcome code for prior unknown submissions", async () => {
  resetRecordStatusState({
    id: 78,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "Processing",
    replicateId: null,
    imageUrl: null,
    errorMsg: "TASK_CREATION_OUTCOME_UNKNOWN: provider timed out",
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:07:00.000Z"),
    executeStartTime: null,
    executeEndTime: null,
    user: null,
  });

  const { GET } = await routePromise;
  const response = await GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-by-id/78",
    ),
    { params: { id: "78" } },
  );
  const body = await response.json();

  assert.equal(body.taskStatus, "submission-unknown");
  assert.equal(body.code, "TASK_CREATION_OUTCOME_UNKNOWN");
  assert.equal(body.createdAt, "2026-10-20T00:00:00.000Z");
});

test("provider success without an output stays processing until a result is durable", async () => {
  resetRecordStatusState({
    id: 79,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "Processing",
    replicateId: "provider-79",
    imageUrl: null,
    errorMsg: null,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:07:00.000Z"),
    executeStartTime: BigInt(1),
    executeEndTime: null,
    user: null,
  });
  recordStatusState.providerStatus = "SUCCESS";
  recordStatusState.providerResult = { code: 0, data: [] };

  const { GET } = await routePromise;
  const response = await GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-by-id/79",
    ),
    { params: { id: "79" } },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "processing");
  assert.equal(body.imageUrl, null);
  assert.equal(recordStatusState.providerResultCalls, 1);
  assert.equal(recordStatusState.task?.taskStatus, "processing");
  assert.equal(recordStatusState.task?.executeEndTime, null);
});

test("provider video success is migrated to private R2 before exposing succeeded", async () => {
  resetRecordStatusState({
    id: 82,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "Processing",
    replicateId: "provider-82",
    imageUrl: null,
    errorMsg: null,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:07:00.000Z"),
    executeStartTime: BigInt(1),
    executeEndTime: null,
    user: null,
  });
  recordStatusState.providerStatus = "SUCCESS";
  recordStatusState.providerResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/results/output.mp4" }],
  };

  const { GET } = await routePromise;
  const response = await GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-by-id/82",
    ),
    { params: { id: "82" } },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(
    recordStatusState.task?.imageUrl,
    recordStatusState.persistedOutput,
  );
  assert.deepEqual(recordStatusState.migrationCalls, [
    {
      url: "https://provider.example.test/results/output.mp4",
      kind: "video",
      recordId: 82,
    },
  ]);
  assert.match(body.imageUrl, /sora2-video-watermark-removal/);
});

test("provider string status is accepted alongside object status", async () => {
  resetRecordStatusState({
    id: 84,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "Processing",
    replicateId: "provider-84",
    imageUrl: null,
    errorMsg: null,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:07:00.000Z"),
    executeStartTime: BigInt(1),
    executeEndTime: null,
    user: null,
  });
  recordStatusState.providerStatus = "SUCCESS";
  recordStatusState.providerStatusAsString = true;
  recordStatusState.providerResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/results/output.mp4" }],
  };

  const { GET } = await routePromise;
  const response = await GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-by-id/84",
    ),
    { params: { id: "84" } },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(recordStatusState.providerResultCalls, 1);
  assert.equal(
    recordStatusState.task?.imageUrl,
    recordStatusState.persistedOutput,
  );
});

test("provider video migration failures remain recoverable processing outcomes", async () => {
  resetRecordStatusState({
    id: 83,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "Processing",
    replicateId: "provider-83",
    imageUrl: null,
    errorMsg: null,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:07:00.000Z"),
    executeStartTime: BigInt(1),
    executeEndTime: null,
    user: null,
  });
  recordStatusState.providerStatus = "SUCCESS";
  recordStatusState.providerResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/results/output.mp4" }],
  };
  recordStatusState.migrationError = new Error("temporary R2 failure");

  const { GET } = await routePromise;
  const response = await GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-by-id/83",
    ),
    { params: { id: "83" } },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "processing");
  assert.equal(recordStatusState.task?.imageUrl, null);
  assert.match(recordStatusState.task?.errorMsg ?? "", /could not be read/);
});

test("provider result read errors remain recoverable instead of becoming success", async () => {
  resetRecordStatusState({
    id: 80,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "Processing",
    replicateId: "provider-80",
    imageUrl: null,
    errorMsg: null,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:07:00.000Z"),
    executeStartTime: BigInt(1),
    executeEndTime: null,
    user: null,
  });
  recordStatusState.providerStatus = "succeeded";
  recordStatusState.providerResultError = new Error(
    "temporary provider read failure",
  );

  const { GET } = await routePromise;
  const response = await GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-by-id/80",
    ),
    { params: { id: "80" } },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "processing");
  assert.equal(recordStatusState.task?.taskStatus, "processing");
  assert.match(recordStatusState.task?.errorMsg ?? "", /could not be read/);
});

test("provider expiry maps to the shared expired lifecycle state", async () => {
  resetRecordStatusState({
    id: 81,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "Processing",
    replicateId: "provider-81",
    imageUrl: null,
    errorMsg: null,
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-21T00:07:00.000Z"),
    executeStartTime: BigInt(1),
    executeEndTime: null,
    user: null,
  });
  recordStatusState.providerStatus = "EXPIRED";

  const { GET } = await routePromise;
  const response = await GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal-by-id/81",
    ),
    { params: { id: "81" } },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "expired");
  assert.equal(recordStatusState.task?.taskStatus, "expired");
});

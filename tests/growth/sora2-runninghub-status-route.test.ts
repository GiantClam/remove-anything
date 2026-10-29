import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test from "node:test";

import {
  recordStatusState,
  resetRecordStatusState,
} from "../support/sora2-record-status-stubs";

const routePromise = import(
  "../../app/api/sora2-video-watermark-removal/[id]/route"
);

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    userId: "owner-1",
    model: "sora2-video-watermark-removal",
    taskStatus: "processing",
    replicateId: "provider-7",
    imageUrl: null,
    errorMsg: null,
    createdAt: new Date("2026-10-28T00:00:00.000Z"),
    executeStartTime: BigInt(1),
    executeEndTime: null,
    user: null,
    ...overrides,
  };
}

async function poll() {
  const { GET } = await routePromise;
  return GET(
    new NextRequest(
      "https://app.example.test/api/sora2-video-watermark-removal/provider-7?dbOnly=false",
    ),
    { params: { id: "provider-7" } },
  );
}

test("provider success is migrated to R2 before polling exposes succeeded", async () => {
  resetRecordStatusState(task());
  recordStatusState.providerStatus = "SUCCESS";
  recordStatusState.providerResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/output.mp4" }],
  };

  const response = await poll();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(recordStatusState.task?.taskStatus, "succeeded");
  assert.equal(
    recordStatusState.task?.imageUrl,
    recordStatusState.persistedOutput,
  );
  assert.deepEqual(recordStatusState.migrationCalls, [
    {
      url: "https://provider.example.test/output.mp4",
      kind: "video",
      recordId: 7,
    },
  ]);
});

test("R2 migration errors keep the provider-complete task recoverable", async () => {
  resetRecordStatusState(task());
  recordStatusState.providerStatus = "SUCCESS";
  recordStatusState.providerResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/output.mp4" }],
  };
  recordStatusState.migrationError = new Error("expired provider URL");

  const response = await poll();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "processing");
  assert.equal(recordStatusState.task?.taskStatus, "processing");
  assert.equal(recordStatusState.task?.executeEndTime, null);
  assert.equal(recordStatusState.task?.errorMsg, "结果暂不可用，请稍后重试");
});

test("succeeded rows without an R2 key are migrated from their stored provider URL", async () => {
  resetRecordStatusState(
    task({
      taskStatus: "succeeded",
      imageUrl: "https://provider.example.test/previous-output.mp4",
    }),
  );

  const response = await poll();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(recordStatusState.providerStatusCalls, 0);
  assert.deepEqual(recordStatusState.migrationCalls, [
    {
      url: "https://provider.example.test/previous-output.mp4",
      kind: "video",
      recordId: 7,
    },
  ]);
  assert.equal(
    recordStatusState.task?.imageUrl,
    recordStatusState.persistedOutput,
  );
});

test("a lost compare-and-set returns the callback result without overwriting it", async () => {
  const callbackOutput =
    "https://files.example.test/sora2-video-watermark-removal/processed/7-callback.mp4";
  resetRecordStatusState(
    task({
      taskStatus: "succeeded",
      imageUrl: "https://provider.example.test/previous-output.mp4",
    }),
  );
  recordStatusState.compareAndSetCallbackResult = {
    taskStatus: "succeeded",
    imageUrl: callbackOutput,
    errorMsg: null,
  };

  const response = await poll();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(recordStatusState.task?.imageUrl, callbackOutput);
  assert.equal(
    body.imageUrl,
    "/api/download?type=sora2-video-watermark-removal&taskId=provider-7&preview=1",
  );
  assert.equal(recordStatusState.providerStatusCalls, 0);
  assert.equal(recordStatusState.compareAndSetCalls.length, 1);
});

test("a callback terminal state without R2 output remains recoverable", async () => {
  resetRecordStatusState(task());
  recordStatusState.compareAndSetCallbackResult = {
    taskStatus: "succeeded",
    imageUrl: "https://provider.example.test/callback-output.mp4",
    errorMsg: null,
  };
  recordStatusState.providerStatus = "SUCCESS";
  recordStatusState.providerResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/poll-output.mp4" }],
  };

  const response = await poll();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "processing");
  assert.equal(recordStatusState.task?.taskStatus, "succeeded");
  assert.equal(
    recordStatusState.task?.imageUrl,
    "https://provider.example.test/callback-output.mp4",
  );
  assert.equal(recordStatusState.providerStatusCalls, 1);
  assert.equal(recordStatusState.providerResultCalls, 1);
});

test("expired stored provider URLs refresh from RunningHub without creating a task", async () => {
  resetRecordStatusState(
    task({
      taskStatus: "succeeded",
      imageUrl: "https://provider.example.test/expired-output.mp4",
    }),
  );
  recordStatusState.migrationError = new Error("expired provider URL");
  recordStatusState.providerStatus = "SUCCESS";
  recordStatusState.providerResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/refreshed-output.mp4" }],
  };

  const response = await poll();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.taskStatus, "succeeded");
  assert.deepEqual(
    recordStatusState.migrationCalls.map(({ url }) => url),
    [
      "https://provider.example.test/expired-output.mp4",
      "https://provider.example.test/refreshed-output.mp4",
    ],
  );
  assert.equal(recordStatusState.providerStatusCalls, 0);
  assert.equal(recordStatusState.providerResultCalls, 1);
  assert.equal(
    recordStatusState.task?.imageUrl,
    recordStatusState.persistedOutput,
  );
});

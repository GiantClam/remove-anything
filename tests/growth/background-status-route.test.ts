import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  backgroundStatusPrisma,
  resetBackgroundStatusState,
  backgroundStatusState as state,
} from "../support/background-status-stubs";

(
  globalThis as typeof globalThis & { __TEST_PRISMA__?: unknown }
).__TEST_PRISMA__ = backgroundStatusPrisma;
process.env.ANONYMOUS_PRINCIPAL_SECRET = "background-status-test-secret";
const routePromise = import("../../app/api/task/[id]/route");
const streamRoutePromise = import(
  "../../app/api/task-status-stream/[taskId]/route"
);
const lifecyclePromise = import("../../lib/task-lifecycle");
const previewUrl = "/api/download-background?taskId=background-17&preview=1";

beforeEach(resetBackgroundStatusState);

function request(query = "", cookie?: string, signal?: AbortSignal) {
  return new NextRequest(
    `https://remove-anything.test/api/task/background-17${query}`,
    {
      headers: cookie ? { cookie } : {},
      signal,
    },
  );
}

async function getStatus(query = "", cookie?: string) {
  const { GET } = await routePromise;
  return GET(request(query, cookie), { params: { id: "background-17" } });
}

async function getStream() {
  const { GET } = await streamRoutePromise;
  const abort = new AbortController();
  const response = await GET(request("", undefined, abort.signal), {
    params: { taskId: "background-17" },
  });
  return { response, abort };
}

async function terminalEvent() {
  const { response, abort } = await getStream();
  const timeout = setTimeout(() => abort.abort(), 1000);
  try {
    const text = await response.text();
    assert.equal(
      abort.signal.aborted,
      false,
      "terminal stream should close without waiting for another poll",
    );
    return JSON.parse(text.trim().replace(/^data: /, ""));
  } finally {
    clearTimeout(timeout);
    abort.abort();
  }
}

test("database-only background statuses use the shared five-state contract", async () => {
  for (const [stored, expected] of [
    ["PENDING", "queued"],
    ["queued", "queued"],
    ["RUNNING", "processing"],
    ["SUCCESS", "succeeded"],
    ["FAILED", "failed"],
    ["timeout", "expired"],
  ]) {
    state.task!.taskStatus = stored;
    state.task!.outputImageUrl =
      expected === "succeeded" ? "https://storage.example.test/background-removal/processed/private-result.png" : null;
    const response = await getStatus("?dbOnly=true");
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.status, expected);
    assert.equal(data.taskStatus, expected);
    assert.equal(data.dbTaskStatus, expected);
    assert.equal(
      response.headers.get("cache-control"),
      "private, no-store, max-age=0",
    );
  }
  assert.equal(state.providerCalls, 0);
});

test("provider success persists the result before making it downloadable", async () => {
  state.providerStatus = "SUCCESS";
  const response = await getStatus();
  const data = await response.json();
  assert.equal(data.status, "succeeded");
  assert.equal(data.output, previewUrl);
  assert.equal(data.outputImageUrl, previewUrl);
  assert.equal(data.imageUrl, previewUrl);
  assert.ok(!JSON.stringify(data).includes(state.providerOutput!));
  assert.equal(state.task!.taskStatus, "succeeded");
  assert.equal(state.task!.outputImageUrl, "https://storage.example.test/background-removal/processed/private-result.png");
  assert.ok(state.task!.executeEndTime);
  const { assertTaskDownloadAccess } = await lifecyclePromise;
  assert.doesNotThrow(() =>
    assertTaskDownloadAccess(state.task!, {
      userId: "background-owner",
      principalId: null,
    }),
  );
});

test("queued and running provider responses stay pollable", async () => {
  for (const [provider, expected] of [
    ["QUEUED", "queued"],
    ["RUNNING", "processing"],
  ]) {
    state.providerStatus = provider;
    const data = await (await getStatus()).json();
    assert.equal(data.status, expected);
    assert.equal(state.task!.taskStatus, expected);
    assert.equal(data.output, null);
  }
});

test("success without output and failed persistence never publish a usable success", async () => {
  state.providerStatus = "SUCCESS";
  state.providerOutput = null;
  let data = await (await getStatus()).json();
  assert.equal(data.status, "processing");
  assert.equal(data.output, null);

  state.providerOutput = "https://provider.example.test/available.png";
  state.writeError = true;
  data = await (await getStatus()).json();
  assert.equal(data.status, "processing");
  assert.equal(data.output, null);
  assert.equal(data.degraded, true);
  assert.equal(state.task!.outputImageUrl, null);
});

test("a slower provider check cannot overwrite a completed webhook", async () => {
  state.beforeUpdate = () => {
    state.task!.taskStatus = "succeeded";
    state.task!.outputImageUrl =
      "https://storage.example.test/webhook-result.png";
  };
  const data = await (await getStatus()).json();
  assert.equal(data.status, "succeeded");
  assert.equal(data.output, previewUrl);
  assert.equal(
    state.task!.outputImageUrl,
    "https://storage.example.test/webhook-result.png",
  );
  assert.deepEqual(state.updates, []);
});

test("a webhook repairing success output cannot be downgraded by a slow empty result", async () => {
  state.task!.taskStatus = "succeeded";
  state.providerStatus = "SUCCESS";
  state.providerOutput = null;
  state.beforeUpdate = () => {
    state.task!.outputImageUrl =
      "https://storage.example.test/repaired-result.png";
  };
  const data = await (await getStatus()).json();
  assert.equal(data.status, "succeeded");
  assert.equal(data.output, previewUrl);
  assert.equal(
    state.task!.outputImageUrl,
    "https://storage.example.test/repaired-result.png",
  );
  assert.deepEqual(state.updates, []);
});

test("ownership failures and unavailable records never call the provider", async () => {
  state.user = { id: "different-user" };
  assert.equal((await getStatus()).status, 403);
  state.user = { id: "background-owner" };
  state.task!.expiresAt = new Date(Date.now() - 1);
  const expired = await getStatus();
  assert.equal(expired.status, 410);
  assert.equal((await expired.json()).status, "expired");
  state.readError = true;
  assert.equal((await getStatus()).status, 503);
  assert.equal(state.providerCalls, 0);
});

test("SSE success persists output and closes immediately", async () => {
  state.providerStatus = "SUCCESS";
  const data = await terminalEvent();
  assert.equal(data.status, "succeeded");
  assert.equal(data.output, previewUrl);
  assert.ok(!JSON.stringify(data).includes(state.providerOutput!));
  assert.equal(state.task!.taskStatus, "succeeded");
});

test("SSE queued state is canonical and reader cancellation releases the stream", async () => {
  state.providerStatus = "QUEUED";
  const { response, abort } = await getStream();
  const reader = response.body!.getReader();
  try {
    const chunk = await reader.read();
    const data = JSON.parse(
      new TextDecoder()
        .decode(chunk.value)
        .trim()
        .replace(/^data: /, ""),
    );
    assert.equal(data.status, "queued");
    await reader.cancel();
  } finally {
    abort.abort();
  }
});

test("SSE expiry, authorization failure, and database errors close with canonical terminal states", async () => {
  state.task!.expiresAt = new Date(Date.now() - 1);
  let data = await terminalEvent();
  assert.equal(data.status, "expired");
  assert.equal(data.code, "TASK_EXPIRED");
  state.task!.expiresAt = new Date(Date.now() + 60_000);
  state.user = { id: "different-user" };
  data = await terminalEvent();
  assert.equal(data.status, "failed");
  assert.equal(data.code, "TASK_FORBIDDEN");
  state.user = { id: "background-owner" };
  state.readError = true;
  data = await terminalEvent();
  assert.equal(data.status, "failed");
  assert.equal(data.code, "TASK_QUERY_FAILED");
  assert.equal(state.providerCalls, 0);
});

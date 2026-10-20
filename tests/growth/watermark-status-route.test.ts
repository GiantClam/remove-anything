import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { GET } from "../../app/api/watermark-removal/[id]/route";
import {
  ANONYMOUS_PRINCIPAL_COOKIE,
  createAnonymousPrincipal,
  verifyAnonymousPrincipal,
} from "../../lib/task-lifecycle";
import {
  resetWatermarkStatusState,
  watermarkStatusState as state,
} from "../support/watermark-status-stubs";

process.env.ANONYMOUS_PRINCIPAL_SECRET = "watermark-status-test-secret";
const originalFetch = globalThis.fetch;
let fetchCount = 0;

beforeEach(() => {
  resetWatermarkStatusState();
  fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("Status routes must not fetch or materialize result files");
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function request(query = "", cookie?: string) {
  return new NextRequest(
    `https://remove-anything.test/api/watermark-removal/task-31${query}`,
    {
      headers: cookie ? { cookie } : undefined,
    },
  );
}

function getStatus(query = "", cookie?: string) {
  return GET(request(query, cookie), { params: { id: "task-31" } });
}

test("watermark status rejects invalid ids and missing tasks", async () => {
  assert.equal((await GET(request(), { params: { id: "" } })).status, 400);
  state.task = null;
  assert.equal((await getStatus()).status, 404);
  assert.deepEqual(state.providerCalls, []);
});

test("watermark status checks ownership and expiry before contacting the provider", async () => {
  state.user = { id: "another-user" };
  const forbidden = await getStatus();
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).code, "TASK_FORBIDDEN");

  state.user = { id: "watermark-owner" };
  state.task!.expiresAt = new Date(Date.now() - 1);
  const expired = await getStatus();
  assert.equal(expired.status, 410);
  assert.equal((await expired.json()).code, "TASK_EXPIRED");
  assert.deepEqual(state.providerCalls, []);
});

test("watermark anonymous tasks remain accessible with the original cookie after sign-in", async () => {
  const token = createAnonymousPrincipal();
  state.task!.userId = null;
  state.task!.principalId = verifyAnonymousPrincipal(token);
  const cookie = `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}`;
  state.user = null;
  assert.equal((await getStatus("?dbOnly=true", cookie)).status, 200);
  state.user = { id: "signed-in-owner" };
  assert.equal((await getStatus("?dbOnly=true", cookie)).status, 200);
  assert.equal((await getStatus("?dbOnly=true")).status, 403);
});

test("database-only watermark status normalizes legacy states and hides raw input URLs", async () => {
  state.task!.taskStatus = "PENDING";
  const response = await getStatus("?dbOnly=true");
  const body = await response.json();
  assert.equal(body.taskStatus, "queued");
  assert.equal(body.inputZipUrl, undefined);
  assert.equal(body.outputZipUrl, undefined);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.equal(response.headers.get("vary"), "Cookie, Authorization");
  assert.deepEqual(state.providerCalls, []);
});

test("repeated successful watermark reads expose a protected ZIP without creating preview files", async () => {
  state.task!.taskStatus = "SUCCESS";
  state.task!.outputZipUrl =
    "https://files.example.test/watermark-removal/processed/result.zip";
  for (const query of ["", "", "?dbOnly=true"]) {
    const response = await getStatus(query);
    const body = await response.json();
    assert.equal(body.taskStatus, "succeeded");
    assert.equal(
      body.outputZipUrl,
      "/api/download?type=watermark-removal&taskId=task-31",
    );
    assert.equal(body.outputImageUrls, undefined);
    assert.equal(body.inputZipUrl, undefined);
  }
  assert.equal(
    state.task!.outputZipUrl,
    "https://files.example.test/watermark-removal/processed/result.zip",
  );
  assert.equal(fetchCount, 0);
  assert.deepEqual(state.providerCalls, []);
  assert.deepEqual(state.updates, []);
});

test("provider success persists its output before returning protected download access", async () => {
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  const response = await getStatus();
  const body = await response.json();
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(
    body.outputZipUrl,
    "/api/download?type=watermark-removal&taskId=task-31",
  );
  assert.equal(state.updates[0]?.data.outputZipUrl, state.persistedOutput);
  assert.deepEqual(state.migrationCalls, [
    {
      url: "https://provider.example.test/result.zip",
      kind: "watermark",
      recordId: 31,
    },
  ]);
  assert.equal(state.updates[0]?.data.taskStatus, "succeeded");
  assert.ok(typeof state.updates[0]?.data.executeEndTime === "bigint");
  assert.equal(fetchCount, 0);
});

test("provider success without an output remains processing and can recover on the next poll", async () => {
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  state.outputResult = { code: 0, data: [{ fileName: "missing-fileUrl.zip" }] };
  const pending = await getStatus();
  assert.equal((await pending.json()).taskStatus, "processing");
  assert.equal(state.task!.taskStatus, "processing");
  assert.equal(state.task!.outputZipUrl, null);
  assert.equal(state.task!.executeEndTime, null);

  state.outputResult = {
    code: 0,
    data: [{ fileUrl: "https://provider.example.test/recovered.zip" }],
  };
  assert.equal((await (await getStatus()).json()).taskStatus, "succeeded");
  assert.equal(state.task!.outputZipUrl, state.persistedOutput);
  assert.equal(fetchCount, 0);
});

test("provider output errors and failed persistence never report false success", async () => {
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  state.outputError = new Error("Result not ready");
  const unavailable = await getStatus();
  const unavailableBody = await unavailable.json();
  assert.equal(unavailableBody.taskStatus, "processing");
  assert.equal(unavailableBody.outputZipUrl, undefined);
  assert.equal(state.task!.executeEndTime, null);

  state.outputError = null;
  state.updateError = new Error("Database write failed");
  const notPersisted = await getStatus();
  assert.equal((await notPersisted.json()).taskStatus, "processing");
  assert.equal(state.task!.outputZipUrl, null);
});

test("old successful records without an output re-enter polling instead of freezing as succeeded", async () => {
  state.task!.taskStatus = "succeeded";
  state.outputResult = { code: 0, data: [] };
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  assert.equal((await (await getStatus()).json()).taskStatus, "processing");
  assert.deepEqual(state.outputCalls, ["task-31"]);
});

test("provider queued running failed and timeout statuses map to the shared contract", async () => {
  for (const [rawStatus, normalized] of [
    ["QUEUED", "queued"],
    ["RUNNING", "processing"],
    ["FAILED", "failed"],
    ["TIMEOUT", "expired"],
  ]) {
    resetWatermarkStatusState();
    state.statusResult = {
      code: 0,
      data: { status: rawStatus, error: "Provider explanation" },
    };
    const body = await (await getStatus()).json();
    assert.equal(body.taskStatus, normalized, rawStatus);
    assert.equal(state.task!.taskStatus, normalized, rawStatus);
    if (["failed", "expired"].includes(normalized))
      assert.equal(body.errorMsg, "Provider explanation");
    assert.equal(body.outputZipUrl, undefined);
  }
});

test("unavailable provider status preserves the persisted task state", async () => {
  state.statusResult = { code: 500, data: {} };
  assert.equal((await (await getStatus()).json()).taskStatus, "processing");
  assert.deepEqual(state.updates, []);
  assert.equal(fetchCount, 0);
});

test("watermark polling uses the exact original provider state as its CAS condition", async () => {
  state.task!.taskStatus = "PENDING";
  state.statusResult = { code: 0, data: { status: "RUNNING" } };
  assert.equal((await (await getStatus()).json()).taskStatus, "processing");
  assert.deepEqual(state.updates[0]?.where, {
    id: 31,
    taskStatus: "PENDING",
    outputZipUrl: null,
    expiresAt: state.task!.expiresAt,
  });
  assert.equal(state.updates[0]?.count, 1);
});

test("a slow running poll preserves a newer webhook success and its protected download", async () => {
  state.statusResult = { code: 0, data: { status: "RUNNING" } };
  state.onStatus = () => {
    state.task!.taskStatus = "succeeded";
    state.task!.outputZipUrl =
      "https://files.example.test/watermark-removal/processed/webhook-winner.zip";
    state.task!.executeEndTime = BigInt(1792020000000);
  };
  const response = await getStatus();
  const body = await response.json();
  assert.equal(state.updates[0]?.count, 0);
  assert.equal(state.task!.taskStatus, "succeeded");
  assert.equal(
    state.task!.outputZipUrl,
    "https://files.example.test/watermark-removal/processed/webhook-winner.zip",
  );
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(body.executeEndTime, "1792020000000");
  assert.equal(
    body.outputZipUrl,
    "/api/download?type=watermark-removal&taskId=task-31",
  );
  assert.equal(JSON.stringify(body).includes("provider.example.test"), false);
  assert.equal(body.inputZipUrl, undefined);
});

test("repair polling cannot downgrade a webhook that filled an old successful record's missing output", async () => {
  state.task!.taskStatus = "succeeded";
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  state.outputResult = { code: 0, data: [] };
  state.onOutput = () => {
    state.task!.outputZipUrl =
      "https://files.example.test/watermark-removal/processed/late-webhook-output.zip";
  };
  const body = await (await getStatus()).json();
  assert.equal(state.updates[0]?.count, 0);
  assert.equal(state.task!.taskStatus, "succeeded");
  assert.equal(
    state.task!.outputZipUrl,
    "https://files.example.test/watermark-removal/processed/late-webhook-output.zip",
  );
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(
    body.outputZipUrl,
    "/api/download?type=watermark-removal&taskId=task-31",
  );
});

test("a late successful provider result cannot resurrect a failed or expired webhook task", async () => {
  for (const terminal of ["failed", "expired"]) {
    resetWatermarkStatusState();
    state.statusResult = { code: 0, data: { status: "SUCCESS" } };
    state.onOutput = () => {
      state.task!.taskStatus = terminal;
      state.task!.errorMsg = "The webhook already closed this task";
      state.task!.executeEndTime = BigInt(1792020000000);
    };
    const body = await (await getStatus()).json();
    assert.equal(state.updates[0]?.count, 0, terminal);
    assert.equal(body.taskStatus, terminal);
    assert.equal(body.outputZipUrl, undefined);
    assert.equal(body.errorMsg, "The webhook already closed this task");
    assert.equal(state.task!.outputZipUrl, null);
    assert.equal(state.task!.executeEndTime, BigInt(1792020000000));
  }
});

test("terminal state from a webhook is reloaded even when the provider status request fails", async () => {
  state.statusError = new Error("Provider request timed out");
  state.onStatus = () => {
    state.task!.taskStatus = "succeeded";
    state.task!.outputZipUrl =
      "https://files.example.test/watermark-removal/processed/completed-during-timeout.zip";
  };
  const body = await (await getStatus()).json();
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(
    body.outputZipUrl,
    "/api/download?type=watermark-removal&taskId=task-31",
  );
  assert.deepEqual(state.updates, []);
});

test("watermark polling rechecks current ownership and expiry before exposing a raced result", async () => {
  for (const change of ["owner", "expiry", "deleted"]) {
    resetWatermarkStatusState();
    state.onStatus = () => {
      if (change === "deleted") {
        state.task = null;
        return;
      }
      state.task!.taskStatus = "succeeded";
      state.task!.outputZipUrl =
        "https://files.example.test/watermark-removal/processed/private-raced-result.zip";
      if (change === "owner") state.task!.userId = "another-owner";
      if (change === "expiry") state.task!.expiresAt = new Date(Date.now() - 1);
    };
    const response = await getStatus();
    assert.equal(
      response.status,
      change === "owner" ? 403 : change === "expiry" ? 410 : 404,
    );
    const body = await response.json();
    assert.equal(body.outputZipUrl, undefined);
    assert.equal(
      JSON.stringify(body).includes("private-raced-result.zip"),
      false,
    );
  }
});

test("legacy provider output stays processing until private migration succeeds", async () => {
  state.task!.taskStatus = "succeeded";
  state.task!.outputZipUrl = "https://provider.example.test/legacy.zip";
  assert.equal(
    (await (await getStatus("?dbOnly=true")).json()).taskStatus,
    "processing",
  );
  state.migrationError = new Error("Storage unavailable");
  let body = await (await getStatus()).json();
  assert.equal(body.taskStatus, "processing");
  assert.equal(body.outputZipUrl, undefined);
  assert.deepEqual(state.providerCalls, []);
  assert.deepEqual(state.outputCalls, []);
  state.statusResult = { code: 0, data: "SUCCESS" };
  state.migrationError = null;
  body = await (await getStatus()).json();
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(state.task!.outputZipUrl, state.persistedOutput);
});

test("a migration failure never publishes success or an external URL", async () => {
  state.statusResult = { code: 0, data: "SUCCESS" };
  state.migrationError = new Error("Storage unavailable");
  const body = await (await getStatus()).json();
  assert.equal(body.taskStatus, "processing");
  assert.equal(body.outputZipUrl, undefined);
  assert.equal(state.task!.executeEndTime, null);
  assert.equal(state.task!.outputZipUrl, null);
});

test("a retention deadline change defeats a slow poll CAS before any write", async () => {
  state.statusResult = { code: 0, data: "SUCCESS" };
  state.onOutput = () => {
    state.task!.expiresAt = new Date(0);
  };
  const response = await getStatus();
  assert.equal(response.status, 410);
  assert.equal(state.updates[0]?.count, 0);
  assert.equal(state.task!.taskStatus, "processing");
  assert.equal(state.task!.outputZipUrl, null);
});

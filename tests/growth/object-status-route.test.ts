import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { GET } from "../../app/api/remove-objects/[id]/route";
import {
  ANONYMOUS_PRINCIPAL_COOKIE,
  createAnonymousPrincipal,
  verifyAnonymousPrincipal,
} from "../../lib/task-lifecycle";
import {
  resetObjectStatusState,
  objectStatusState as state,
} from "../support/object-status-stubs";

process.env.ANONYMOUS_PRINCIPAL_SECRET = "object-status-test-secret";
const originalFetch = globalThis.fetch;
beforeEach(() => {
  resetObjectStatusState();
  globalThis.fetch = async () => {
    throw new Error("Status test crossed an unstubbed network boundary");
  };
});
afterEach(() => {
  assert.equal(state.createCalls, 0);
  globalThis.fetch = originalFetch;
});
function request(query = "", cookie?: string) {
  return new NextRequest(
    `https://remove-anything.test/api/remove-objects/object-task-51${query}`,
    { headers: cookie ? { cookie } : undefined },
  );
}
function getStatus(query = "", cookie?: string) {
  return GET(request(query, cookie), { params: { id: "object-task-51" } });
}
const preview = "/api/download-object?taskId=object-task-51&preview=1";

test("object status checks task id, current owner, and expiry before provider reads", async () => {
  assert.equal((await GET(request(), { params: { id: "" } })).status, 400);
  state.user = { id: "another-owner" };
  assert.equal((await getStatus()).status, 403);
  state.user = { id: "object-owner" };
  state.task!.expiresAt = new Date(Date.now() - 1);
  assert.equal((await getStatus()).status, 410);
  state.task = null;
  assert.equal((await getStatus()).status, 404);
  assert.deepEqual(state.statusCalls, []);
});

test("object anonymous ownership survives sign-in with the original principal cookie", async () => {
  const token = createAnonymousPrincipal();
  state.task!.userId = null;
  state.task!.principalId = verifyAnonymousPrincipal(token);
  const cookie = `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}`;
  state.user = { id: "signed-in-owner" };
  assert.equal((await getStatus("?dbOnly=true", cookie)).status, 200);
  assert.equal((await getStatus("?dbOnly=true")).status, 403);
});

test("database-only object reads expose all five shared states with protected outputs only", async () => {
  for (const status of [
    "queued",
    "processing",
    "succeeded",
    "failed",
    "expired",
  ]) {
    resetObjectStatusState();
    state.task!.taskStatus = status;
    state.task!.outputImageUrl =
      status === "succeeded" ? state.persistedOutput : null;
    const response = await getStatus("?dbOnly=true");
    const body = await response.json();
    assert.equal(body.taskStatus, status);
    assert.equal(
      body.outputImageUrl,
      status === "succeeded" ? preview : undefined,
    );
    assert.equal(body.inputImageUrl, undefined);
    assert.equal(JSON.stringify(body).includes("files.example.test"), false);
    assert.equal(
      response.headers.get("cache-control"),
      "private, no-store, max-age=0",
    );
    assert.equal(response.headers.get("vary"), "Cookie, Authorization");
    assert.deepEqual(state.statusCalls, []);
  }
});

test("queued object tasks poll existing work and CAS the exact legacy snapshot", async () => {
  state.task!.taskStatus = "PENDING";
  const body = await (await getStatus()).json();
  assert.equal(body.taskStatus, "processing");
  assert.deepEqual(state.statusCalls, ["object-task-51"]);
  assert.deepEqual(state.updates[0].where, {
    id: 51,
    taskStatus: "PENDING",
    outputImageUrl: null,
    expiresAt: state.task!.expiresAt,
  });
  assert.ok(typeof state.task!.executeStartTime === "bigint");
});

test("provider statuses map to the five-state contract and success requires private persistence", async () => {
  for (const [providerStatus, expected] of [
    ["QUEUED", "queued"],
    ["SUBMITTED", "queued"],
    ["RUNNING", "processing"],
    ["EXECUTING", "processing"],
    ["SUCCESS", "succeeded"],
    ["FAILED", "failed"],
    ["TIMEOUT", "expired"],
  ]) {
    resetObjectStatusState();
    state.statusResult = {
      code: 0,
      data: { status: providerStatus, error: "Provider explanation" },
    };
    const body = await (await getStatus()).json();
    assert.equal(body.taskStatus, expected);
    assert.equal(state.task!.taskStatus, expected);
    assert.equal(
      body.outputImageUrl,
      expected === "succeeded" ? preview : undefined,
    );
    if (expected === "succeeded") {
      assert.deepEqual(state.migrationCalls, [
        {
          url: "https://provider.example.test/results/output.png",
          kind: "object",
          recordId: 51,
        },
      ]);
      assert.equal(state.task!.outputImageUrl, state.persistedOutput);
    }
  }
});

test("missing provider output and retrieval errors remain pollable without false success", async () => {
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  state.outputResult = { code: 0, data: [] };
  let body = await (await getStatus()).json();
  assert.equal(body.taskStatus, "processing");
  assert.equal(body.outputImageUrl, undefined);
  assert.deepEqual(state.migrationCalls, []);
  state.outputError = new Error("APIKEY_TASK_IS_RUNNING");
  body = await (await getStatus()).json();
  assert.equal(body.taskStatus, "processing");
  assert.equal(state.task!.executeEndTime, null);
});

test("migration and database failures keep outputs unpublished and can recover on the next poll", async () => {
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  state.migrationError = new Error("Private storage unavailable");
  const migrationFailure = await (await getStatus()).json();
  assert.equal(migrationFailure.taskStatus, "processing");
  assert.equal(migrationFailure.outputImageUrl, undefined);
  assert.equal(state.task!.outputImageUrl, null);
  state.migrationError = null;
  state.updateError = new Error("Database unavailable");
  assert.equal((await (await getStatus()).json()).taskStatus, "processing");
  assert.equal(state.task!.outputImageUrl, null);
  state.updateError = null;
  assert.equal((await (await getStatus()).json()).outputImageUrl, preview);
});

test("legacy success with a raw provider URL is not published until private migration succeeds", async () => {
  state.task!.taskStatus = "succeeded";
  state.task!.outputImageUrl =
    "https://provider.example.test/results/legacy.png";
  state.migrationError = new Error("Storage unavailable");
  const body = await (await getStatus()).json();
  assert.equal(body.taskStatus, "processing");
  assert.equal(body.outputImageUrl, undefined);
  // Failed private migration must clear raw provider URLs from output_*.
  assert.equal(state.task!.outputImageUrl, null);
  assert.deepEqual(state.statusCalls, []);
  assert.equal(
    (await (await getStatus("?dbOnly=true")).json()).outputImageUrl,
    undefined,
  );
});

test("legacy success without an output resumes polling", async () => {
  state.task!.taskStatus = "succeeded";
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  state.outputResult = { code: 0, data: [] };
  assert.equal((await (await getStatus()).json()).taskStatus, "processing");
  assert.deepEqual(state.outputCalls, ["object-task-51"]);
});

test("a slow running poll preserves a newer callback success and reloads its protected output", async () => {
  state.onStatus = () => {
    state.task!.taskStatus = "succeeded";
    state.task!.outputImageUrl = state.persistedOutput;
  };
  const body = await (await getStatus()).json();
  assert.equal(state.updates[0].count, 0);
  assert.equal(body.taskStatus, "succeeded");
  assert.equal(body.outputImageUrl, preview);
  assert.equal(JSON.stringify(body).includes("files.example.test"), false);
});

test("late successful result migration cannot resurrect a failed or expired callback task", async () => {
  for (const terminal of ["failed", "expired"]) {
    resetObjectStatusState();
    state.statusResult = { code: 0, data: { status: "SUCCESS" } };
    state.onMigration = () => {
      state.task!.taskStatus = terminal;
      state.task!.errorMsg = "Callback closed this task";
    };
    const body = await (await getStatus()).json();
    assert.equal(state.updates[0].count, 0);
    assert.equal(body.taskStatus, terminal);
    assert.equal(body.outputImageUrl, undefined);
    assert.equal(state.task!.outputImageUrl, null);
  }
});

test("a callback is reloaded even when the provider request fails", async () => {
  state.statusError = new Error("Provider timeout");
  state.onStatus = () => {
    state.task!.taskStatus = "succeeded";
    state.task!.outputImageUrl = state.persistedOutput;
  };
  assert.equal((await (await getStatus()).json()).outputImageUrl, preview);
  assert.deepEqual(state.updates, []);
});

test("object status rechecks changed ownership, expiry, and deletion after polling", async () => {
  for (const change of ["owner", "expiry", "deleted"]) {
    resetObjectStatusState();
    state.onStatus = () => {
      if (change === "deleted") {
        state.task = null;
        return;
      }
      state.task!.taskStatus = "succeeded";
      state.task!.outputImageUrl = state.persistedOutput;
      if (change === "owner") state.task!.userId = "another-owner";
      if (change === "expiry") state.task!.expiresAt = new Date(Date.now() - 1);
    };
    const response = await getStatus();
    assert.equal(
      response.status,
      change === "owner" ? 403 : change === "expiry" ? 410 : 404,
    );
    assert.equal((await response.json()).outputImageUrl, undefined);
  }
});

test("an unchanged deadline elapsed during a slow poll prevents any state write", async (t) => {
  const originalExpiry = state.task!.expiresAt.getTime();
  state.onStatus = () => {
    t.mock.method(Date, "now", () => originalExpiry + 1);
  };
  const response = await getStatus();
  assert.equal(response.status, 410);
  assert.equal((await response.json()).code, "TASK_EXPIRED");
  assert.deepEqual(state.updates, []);
  assert.equal(state.task!.taskStatus, "processing");
  assert.equal(state.task!.outputImageUrl, null);
});

test("an early expiry during result migration loses CAS without publishing or changing task state", async () => {
  const originalExpiry = state.task!.expiresAt;
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  state.onMigration = () => {
    state.task!.expiresAt = new Date(Date.now() - 1);
  };
  const response = await getStatus();
  assert.equal(response.status, 410);
  assert.equal((await response.json()).code, "TASK_EXPIRED");
  assert.equal(state.updates[0].where.expiresAt, originalExpiry);
  assert.equal(state.updates[0].count, 0);
  assert.equal(state.task!.taskStatus, "processing");
  assert.equal(state.task!.outputImageUrl, null);
});

test("a changed future deadline also blocks a stale poll with the same state and output", async () => {
  const originalExpiry = state.task!.expiresAt;
  const newExpiry = new Date(originalExpiry.getTime() + 60_000);
  state.statusResult = { code: 0, data: { status: "SUCCESS" } };
  state.onMigration = () => {
    state.task!.expiresAt = newExpiry;
  };
  const body = await (await getStatus()).json();
  assert.equal(state.updates[0].where.expiresAt, originalExpiry);
  assert.equal(state.updates[0].count, 0);
  assert.equal(body.taskStatus, "processing");
  assert.equal(body.outputImageUrl, undefined);
  assert.equal(state.task!.expiresAt, newExpiry);
});

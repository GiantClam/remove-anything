import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import {
  resetRetentionRouteState,
  retentionRoutePrisma,
  retentionRouteState as state,
} from "../support/retention-route-stubs";

(
  globalThis as typeof globalThis & { __TEST_PRISMA__?: unknown }
).__TEST_PRISMA__ = retentionRoutePrisma;
const routePromise = import("../../app/api/cron/cleanup-tasks/route");
const envKeys = [
  "CRON_SECRET",
  "R2_URL_BASE",
  "TASK_RETENTION_EXECUTE",
  "TASK_RETENTION_BATCH_SIZE",
  "TASK_RETENTION_CRON_ENABLED",
] as const;
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
  resetRetentionRouteState();
  process.env.CRON_SECRET = "test-retention-secret";
  process.env.R2_URL_BASE = "https://retention.example.test";
  delete process.env.TASK_RETENTION_EXECUTE;
  delete process.env.TASK_RETENTION_BATCH_SIZE;
  delete process.env.TASK_RETENTION_CRON_ENABLED;
});
after(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});
function request(
  query = "",
  authorization: string | null = "Bearer test-retention-secret",
) {
  return new NextRequest(
    `https://remove-anything.test/api/cron/cleanup-tasks${query}`,
    { headers: authorization ? { authorization } : {} },
  );
}
function assertNoBoundariesCalled() {
  assert.equal(state.storageCreates, 0);
  assert.deepEqual(state.reads, []);
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.auditDeletes, []);
  assert.deepEqual(state.deletedKeys, []);
}

test("cleanup cron fails closed for missing and empty secrets", async () => {
  const { GET } = await routePromise;
  for (const secret of [undefined, "", "   "]) {
    if (secret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = secret;
    const response = await GET(request());
    assert.equal(response.status, 503);
    assert.equal(
      (await response.json()).error,
      "cron secret is not configured",
    );
    assertNoBoundariesCalled();
  }
});

test("cleanup cron rejects absent or incorrect authentication before data access", async () => {
  const { GET } = await routePromise;
  for (const authorization of [
    null,
    "Bearer wrong-secret",
    "Bearer undefined",
  ]) {
    assert.equal((await GET(request("", authorization))).status, 401);
    assertNoBoundariesCalled();
  }
});

test("authenticated cleanup skips dry-run by default to protect session pool", async () => {
  const { GET } = await routePromise;
  const response = await GET(request());
  const report = await response.json();
  assert.equal(response.status, 200);
  assert.equal(report.skipped, true);
  assert.equal(report.code, "RETENTION_CRON_DISABLED");
  assert.equal(report.executionEnabled, false);
  assertNoBoundariesCalled();
});

test("authenticated cleanup dry-run runs only when TASK_RETENTION_CRON_ENABLED=true", async () => {
  process.env.TASK_RETENTION_CRON_ENABLED = "true";
  const { GET } = await routePromise;
  const response = await GET(request());
  const report = await response.json();
  assert.equal(response.status, 200);
  assert.equal(report.executionEnabled, false);
  assert.equal(report.dryRun, true);
  assert.equal(report.batchSize, 100);
  assert.equal(report.filesWouldDelete, 1);
  assert.equal(report.filesDeleted, 0);
  assert.equal(state.storageCreates, 1);
  assert.ok(state.reads.length > 0);
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.auditDeletes, []);
  assert.deepEqual(state.deletedKeys, []);
});

test("query parameters cannot enable cleanup execution or override batch size", async () => {
  process.env.TASK_RETENTION_CRON_ENABLED = "true";
  const { GET } = await routePromise;
  const response = await GET(
    request(
      "?execute=true&dryRun=false&TASK_RETENTION_EXECUTE=true&batchSize=500",
    ),
  );
  const report = await response.json();
  assert.equal(report.executionEnabled, false);
  assert.equal(report.dryRun, true);
  assert.equal(report.batchSize, 100);
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.deletedKeys, []);
});

test("execution opt-in runs the scrub-first retention worker when explicitly enabled", async () => {
  const { GET } = await routePromise;
  process.env.TASK_RETENTION_CRON_ENABLED = "true";
  process.env.TASK_RETENTION_EXECUTE = "true";
  process.env.TASK_RETENTION_BATCH_SIZE = "9999";
  const response = await GET(request());
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.executionEnabled, true);
  assert.equal(body.dryRun, false);
  assert.equal(body.batchSize, 500);
});

test("batch sizes clamp to one and malformed values use the default", async () => {
  process.env.TASK_RETENTION_CRON_ENABLED = "true";
  const { GET } = await routePromise;
  process.env.TASK_RETENTION_BATCH_SIZE = "-9";
  assert.equal((await (await GET(request())).json()).batchSize, 1);
  process.env.TASK_RETENTION_BATCH_SIZE = "not-a-number";
  assert.equal((await (await GET(request())).json()).batchSize, 100);
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.deletedKeys, []);
});

test("missing R2 URL configuration returns unavailable before the runner is called", async () => {
  process.env.TASK_RETENTION_CRON_ENABLED = "true";
  const { GET } = await routePromise;
  delete process.env.R2_URL_BASE;
  const response = await GET(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "R2_URL_BASE is not configured");
  assertNoBoundariesCalled();
});

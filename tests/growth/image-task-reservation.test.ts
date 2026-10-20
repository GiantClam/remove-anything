import assert from "node:assert/strict";
import test from "node:test";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ANONYMOUS_PRINCIPAL_SECRET = "unit-test-principal-secret";

type ModelName = "backgroundRemovalTask" | "watermarkRemovalTask" | "objectRemovalTask";
type Row = Record<string, any>;
const state: Record<ModelName, Row[]> = {
  backgroundRemovalTask: [],
  watermarkRemovalTask: [],
  objectRemovalTask: [],
};
let transactionAttempts = 0;
let transactionIsolation: unknown;
let transactionCalls = 0;
let quotaReads = 0;
let version = 0;
const quotaFilters: any[] = [];
function reset() {
  for (const rows of Object.values(state)) rows.splice(0, rows.length);
  transactionAttempts = 0;
  transactionIsolation = undefined;
  transactionCalls = 0;
  quotaReads = 0;
  version = 0;
  quotaFilters.length = 0;
}
function client(rows = state) {
  const models: Record<string, any> = {};
  for (const model of Object.keys(state) as ModelName[]) {
    models[model] = {
      count: async ({ where }: any) => {
        quotaReads++;
        quotaFilters.push(where);
        return rows[model].filter((row) => {
        const subject = where.userId ?? where.principalId;
        const value = row.userId ?? row.principalId;
        const statuses = where.taskStatus?.in || [];
        return value === subject && statuses.includes(row.taskStatus) && new Date(row.createdAt).getTime() >= where.createdAt.gte.getTime();
        }).length;
      },
      findFirst: async ({ where }: any) => rows[model].find((row) => row.idempotencyKey === where.idempotencyKey && (where.userId === undefined || row.userId === where.userId) && (where.principalId === undefined || row.principalId === where.principalId) && !where.taskStatus?.notIn?.includes(row.taskStatus)) || null,
      create: async ({ data }: any) => {
        const row = { id: rows[model].length + 1, createdAt: new Date(), ...data };
        rows[model].push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const row = rows[model].find((candidate) => candidate.id === where.id && where.taskStatus?.in?.includes(candidate.taskStatus));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    };
  }
  models.taskData = { count: async () => 0 };
  return models;
}
(globalThis as typeof globalThis & { __TEST_PRISMA__?: any }).__TEST_PRISMA__ = {
  ...client(),
  $transaction: async (callback: (tx: any) => Promise<any>, options?: any) => {
    transactionCalls++;
    transactionIsolation = options?.isolationLevel;
    if (transactionAttempts > 0) {
      transactionAttempts -= 1;
      const error: any = new Error("serialization conflict");
      error.code = "P2034";
      throw error;
    }
    const readVersion = version;
    const snapshot = Object.fromEntries(Object.entries(state).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))])) as typeof state;
    const result = await callback(client(snapshot));
    if (readVersion !== version) throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
    for (const model of Object.keys(state) as ModelName[]) state[model].splice(0, state[model].length, ...snapshot[model]);
    version++;
    return result;
  },
};

const reservationPromise = import("../../lib/image-task-reservation");

test.beforeEach(reset);

test("reservation checks idempotency before quota and uses a serializable transaction", async () => {
  const { reserveImageTask } = await reservationPromise;
  const first = await reserveImageTask({
    model: "objectRemovalTask",
    principal: { userId: null, principalId: "anon-1" },
    idempotencyKey: "same-key",
    data: { runninghubTaskId: "pending-a", inputImageUrl: "source", inputMaskUrl: "mask" },
  });
  assert.equal(first.idempotent, false);
  assert.equal(transactionIsolation, "Serializable");
  const readsBeforeRetry = quotaReads;
  const second = await reserveImageTask({
    model: "objectRemovalTask",
    principal: { userId: null, principalId: "anon-1" },
    idempotencyKey: "same-key",
    data: { runninghubTaskId: "pending-b", inputImageUrl: "source", inputMaskUrl: "mask" },
  });
  assert.equal(second.idempotent, true);
  assert.equal(second.task.id, first.task.id);
  assert.equal(state.objectRemovalTask.length, 1);
  assert.equal(quotaReads, readsBeforeRetry);
});

test("three serialization conflicts exhaust the bounded reservation retry", async () => {
  const { reserveImageTask } = await reservationPromise;
  transactionAttempts = 9;
  await assert.rejects(reserveImageTask({
    model: "backgroundRemovalTask",
    principal: { userId: "busy-user", principalId: null },
    idempotencyKey: "busy-key",
    data: { replicateId: "pending-busy", inputImageUrl: "source" },
  }), (error: any) => error.code === "QUOTA_STORAGE_UNAVAILABLE" && /same idempotency key/.test(error.message));
  assert.equal(transactionCalls, 3);
  assert.equal(state.backgroundRemovalTask.length, 0);
});

test("an idempotent task is returned at a full monthly quota without reading quota tables", async () => {
  const { reserveImageTask } = await reservationPromise;
  state.backgroundRemovalTask.push({ id: 7, userId: "full-user", principalId: null, taskStatus: "succeeded", idempotencyKey: "existing-key", replicateId: "provider-7" });
  state.objectRemovalTask.push(...Array.from({ length: 5 }, (_, id) => ({ id, userId: "full-user", principalId: null, taskStatus: "succeeded" })));
  const result = await reserveImageTask({
    model: "backgroundRemovalTask",
    principal: { userId: "full-user", principalId: null },
    idempotencyKey: "existing-key",
    data: { replicateId: "pending-new", inputImageUrl: "source" },
  });
  assert.equal(result.idempotent, true);
  assert.equal(result.task.id, 7);
  assert.equal(quotaReads, 0);
  assert.equal(state.backgroundRemovalTask.length, 1);
});

test("concurrent anonymous reservations serialize and reject the second free task", async () => {
  const { reserveImageTask } = await reservationPromise;
  const results = await Promise.allSettled(["a", "b"].map((key) => reserveImageTask({
    model: "objectRemovalTask",
    principal: { userId: null, principalId: "concurrent-anon" },
    idempotencyKey: key,
    data: { runninghubTaskId: `pending-${key}`, inputImageUrl: "source", inputMaskUrl: "mask" },
  })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "QUOTA_EXCEEDED");
  assert.equal(state.objectRemovalTask.length, 1);
  assert.equal(transactionCalls, 3);
});

test("concurrent same-key submissions reuse one committed reservation", async () => {
  const { reserveImageTask } = await reservationPromise;
  const results = await Promise.all(["a", "b"].map((suffix) => reserveImageTask({
    model: "backgroundRemovalTask",
    principal: { userId: null, principalId: "same-key-anon" },
    idempotencyKey: "concurrent-key",
    data: { replicateId: `pending-${suffix}`, inputImageUrl: "source" },
  })));
  assert.equal(results[0].task.id, results[1].task.id);
  assert.equal(results.filter((result) => result.idempotent).length, 1);
  assert.equal(state.backgroundRemovalTask.length, 1);
});

test("expired completed records consume the UTC monthly allowance while failed and older work do not", async () => {
  const { reserveImageTask } = await reservationPromise;
  const now = new Date("2026-10-15T05:00:00Z");
  state.backgroundRemovalTask.push(...Array.from({ length: 5 }, (_, id) => ({ id, userId: "month-user", taskStatus: "expired", createdAt: new Date("2026-10-02T00:00:00Z") })));
  state.backgroundRemovalTask.push({ id: 6, userId: "month-user", taskStatus: "failed", createdAt: now });
  state.objectRemovalTask.push({ id: 7, userId: "month-user", taskStatus: "succeeded", createdAt: new Date("2026-09-30T23:59:59Z") });
  await assert.rejects(reserveImageTask({
    model: "watermarkRemovalTask", principal: { userId: "month-user", principalId: null }, now,
    data: { runninghubTaskId: "pending-month", inputZipUrl: "" },
  }), (error: any) => error.code === "QUOTA_EXCEEDED");
  assert.ok(quotaFilters.every((where) => where.createdAt.gte.toISOString() === "2026-10-01T00:00:00.000Z"));
  state.backgroundRemovalTask.splice(0, 1);
  await assert.doesNotReject(reserveImageTask({
    model: "watermarkRemovalTask", principal: { userId: "month-user", principalId: null }, now,
    data: { runninghubTaskId: "pending-month", inputZipUrl: "" },
  }));
});

test("P2034 retries the whole reservation without creating a duplicate", async () => {
  const { reserveImageTask } = await reservationPromise;
  transactionAttempts = 1;
  const result = await reserveImageTask({
    model: "backgroundRemovalTask",
    principal: { userId: null, principalId: "anon-2" },
    idempotencyKey: "retry-key",
    data: { replicateId: "pending-a", inputImageUrl: "source" },
  });
  assert.equal(result.idempotent, false);
  assert.equal(state.backgroundRemovalTask.length, 1);
});

test("failed provider setup marks only the queued reservation failed and frees quota", async () => {
  const { markImageTaskReservationFailed, reserveImageTask } = await reservationPromise;
  const reservation = await reserveImageTask({
    model: "watermarkRemovalTask",
    principal: { userId: null, principalId: "anon-3" },
    idempotencyKey: "failed-key",
    data: { runninghubTaskId: "pending-a", inputZipUrl: "" },
  });
  assert.equal((await markImageTaskReservationFailed("watermarkRemovalTask", reservation.task.id, new Error("provider upload failed"))).count, 1);
  assert.equal(state.watermarkRemovalTask[0].taskStatus, "failed");
  const retry = await reserveImageTask({
    model: "watermarkRemovalTask",
    principal: { userId: null, principalId: "anon-3" },
    idempotencyKey: "failed-key",
    data: { runninghubTaskId: "pending-b", inputZipUrl: "" },
  });
  assert.equal(retry.idempotent, false);
  assert.equal(state.watermarkRemovalTask.length, 2);
});

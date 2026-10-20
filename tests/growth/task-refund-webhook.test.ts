import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  env,
  resetTaskRefundState,
  taskRefundPrisma,
  taskRefundState as state,
} from "../support/task-refund-stubs";

(process.env as unknown as Record<string, string>).NODE_ENV = "test";
(globalThis as typeof globalThis & { __TEST_PRISMA__?: unknown }).__TEST_PRISMA__ = taskRefundPrisma;
const routePromise = import("../../app/api/webhooks/task/route");
const lifecyclePromise = import("../../lib/task-lifecycle");

beforeEach(resetTaskRefundState);

function request(status = "failed", key: string | null = env.TASK_HEADER_KEY) {
  return new Request("https://remove-anything.test/api/webhooks/task", {
    method: "POST",
    headers: key ? { "remove-anything-webhook-key": key } : {},
    body: JSON.stringify({ taskStatus: status, replicateId: "provider-17" }),
  });
}

async function callback(status = "failed") {
  return (await routePromise).POST(request(status));
}

function assertRefundedOnce() {
  assert.equal(state.credit, 11, "refund must add the seven actually consumed credits");
  assert.equal(state.refundClaims, 1);
  assert.equal(state.billings.find((entry) => entry.id === 91)?.state, "Refunded");
  const refunds = state.billings.filter((entry) => entry.type === "Refund");
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amount, 7);
  assert.equal(refunds[0].description, "Task credit refund - withdrawal 91");
  const returnedCredits = state.creditTransactions.filter((entry) => entry.credit > 0);
  assert.equal(returnedCredits.length, 1);
  assert.equal(returnedCredits[0].credit, 7);
  assert.equal(returnedCredits[0].balance, 11);
  assert.equal(returnedCredits[0].billingId, refunds[0].id);
  const events = state.events.filter((event) => event.name === "credits_refunded");
  assert.equal(events.length, 1);
  assert.equal(events[0].params.credits_before, 4);
  assert.equal(events[0].params.credits_after, 11);
  assert.equal(events[0].params.event_id, `credits_refunded:transaction:${returnedCredits[0].id}`);
}

test("processing and success callbacks never refund and terminal success cannot regress", async () => {
  state.task!.taskStatus = "pending";
  assert.equal((await callback("processing")).status, 200);
  assert.equal((await callback("succeeded")).status, 200);
  assert.equal((await callback("failed")).status, 200);
  assert.equal(state.task!.taskStatus, "succeeded");
  assert.equal(state.credit, 4);
  assert.equal(state.transactionCalls, 0);
  assert.equal(state.refundCasAttempts, 0);
  assert.deepEqual(state.events.map((event) => event.name), [
    "task_processing",
    "processing_started",
    "task_succeeded",
    "processing_completed",
  ]);
});

test("duplicate failed callbacks return only the real consumed debit once", async () => {
  assert.equal((await callback()).status, 200);
  assert.equal((await callback()).status, 200);
  assertRefundedOnce();
  assert.equal(state.events.filter((event) => event.name === "task_failed").length, 1);
  assert.equal(state.events.filter((event) => event.name === "processing_failed").length, 1);
  assert.equal(state.notifications, 1);
});

test("normalizing an existing terminal status does not emit another lifecycle event", async () => {
  state.task!.taskStatus = "SUCCEEDED";
  assert.equal((await callback("succeeded")).status, 200);
  assert.equal(state.task!.taskStatus, "succeeded");
  assert.equal(state.credit, 4);
  assert.deepEqual(state.events, []);
});

test("concurrent failed callbacks share the withdrawal CAS and emit one refund fact", async () => {
  const responses = await Promise.all([callback(), callback()]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(state.refundCasAttempts, 2, "both transactions must reach the competing debit claim");
  assertRefundedOnce();
  assert.equal(state.events.filter((event) => event.name === "task_failed").length, 1);
  assert.equal(state.events.filter((event) => event.name === "processing_failed").length, 1);
  assert.equal(state.notifications, 1);
});

test("a callback and watcher racing to refund use the same debit lock", async () => {
  state.task!.taskStatus = "failed";
  const { refundFailedTaskCredit } = await lifecyclePromise;
  const [response] = await Promise.all([callback(), refundFailedTaskCredit("task-owner", 17, "image")]);
  assert.equal(response.status, 200);
  assertRefundedOnce();
});

test("canceled work refunds with a positive sign and canonical failure state", async () => {
  assert.equal((await callback("canceled")).status, 200);
  assert.equal(state.task!.taskStatus, "failed");
  assertRefundedOnce();
});

test("free tasks, missing debit transactions, and mismatched ledgers cannot create credits", async () => {
  state.billings.length = 0;
  assert.equal((await callback()).status, 200);
  assert.equal(state.credit, 4);
  assert.equal(state.refundCasAttempts, 0);

  resetTaskRefundState();
  state.creditTransactions.length = 0;
  assert.equal((await callback()).status, 200);
  assert.equal(state.credit, 4);
  assert.equal(state.refundCasAttempts, 0);

  resetTaskRefundState();
  state.creditTransactions[0].credit = -6;
  assert.equal((await callback()).status, 200);
  assert.equal(state.credit, 4);
  assert.equal(state.refundCasAttempts, 0);
  assert.equal(state.events.filter((event) => event.name === "credits_refunded").length, 0);
});

test("a failed refund transaction rolls back its claim and can safely retry", async () => {
  state.failNextLedgerWrite = true;
  assert.equal((await callback()).status, 500);
  assert.equal(state.credit, 4);
  assert.equal(state.billings[0].state, "Done");
  assert.equal(state.billings.length, 1);
  assert.equal(state.creditTransactions.length, 1);
  assert.equal(state.events.filter((event) => event.name === "credits_refunded").length, 0);

  assert.equal((await callback()).status, 200);
  assertRefundedOnce();
  assert.equal(state.events.filter((event) => event.name === "task_failed").length, 1);
});

test("background refunds require their exact legacy external-task description", async () => {
  state.backgroundTask!.taskStatus = "failed";
  state.billings[0].taskId = null;
  state.billings[0].description = "Background Removal - Task another-task";
  const { refundFailedTaskCredit } = await lifecyclePromise;
  assert.equal(await refundFailedTaskCredit("task-owner", 17, "background-removal"), false);
  assert.equal(state.credit, 4);

  state.billings[0].description = "Background Removal - Task background-17";
  assert.equal(await refundFailedTaskCredit("task-owner", 17, "background-removal"), true);
  assertRefundedOnce();
});

test("legacy refund records and other users cannot be refunded again", async () => {
  state.task!.taskStatus = "failed";
  state.billings.push({ id: 92, userId: "task-owner", state: "Done", amount: 7, type: "Refund", taskId: 17, description: "Task credit refund - 17" });
  const { refundFailedTaskCredit } = await lifecyclePromise;
  assert.equal(await refundFailedTaskCredit("task-owner", 17, "image"), false);
  assert.equal(await refundFailedTaskCredit("different-user", 17, "image"), false);
  assert.equal(state.credit, 4);
  assert.equal(state.refundCasAttempts, 0);
});

test("invalid callback authentication and unsupported statuses perform no writes", async () => {
  const { POST } = await routePromise;
  assert.equal((await POST(request("failed", null))).status, 400);
  assert.equal((await POST(request("failed", "wrong-key"))).status, 400);
  assert.equal((await callback("unknown-provider-status")).status, 400);
  assert.equal(state.statusCasAttempts, 0);
  assert.equal(state.transactionCalls, 0);
  assert.equal(state.credit, 4);
  assert.deepEqual(state.events, []);
});

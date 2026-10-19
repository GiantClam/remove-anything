import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYTICS_EVENTS,
  createAnalyticsEvent,
  createCreditsAnalyticsEvent,
  createOrderAnalyticsEvent,
  createTaskAnalyticsEvent,
  emitServerAnalyticsEvent,
  getFileSizeBucket,
} from "../../lib/analytics-events";

test("file-size buckets are stable at every documented boundary", () => {
  const mb = 1024 * 1024;
  assert.equal(getFileSizeBucket(0), "0-1mb");
  assert.equal(getFileSizeBucket(mb), "0-1mb");
  assert.equal(getFileSizeBucket(mb + 1), "1-5mb");
  assert.equal(getFileSizeBucket(5 * mb), "1-5mb");
  assert.equal(getFileSizeBucket(5 * mb + 1), "5-10mb");
  assert.equal(getFileSizeBucket(10 * mb), "5-10mb");
  assert.equal(getFileSizeBucket(10 * mb + 1), "10-50mb");
  assert.equal(getFileSizeBucket(50 * mb), "10-50mb");
  assert.equal(getFileSizeBucket(50 * mb + 1), "50mb+");
  assert.equal(getFileSizeBucket(Number.NaN), "0-1mb");
});

test("task and payment events carry stable deduplication keys", () => {
  const task = createTaskAnalyticsEvent(ANALYTICS_EVENTS.taskSucceeded, 42, {
    tool_slug: "remove-background",
    locale: "en",
  });
  const retriedTask = createTaskAnalyticsEvent(ANALYTICS_EVENTS.taskSucceeded, 42, {
    tool_slug: "remove-background",
    locale: "en",
  });
  assert.equal(task.params.task_id, "42");
  assert.equal(task.params.event_id, "task_succeeded:task:42");
  assert.deepEqual(retriedTask.params, task.params);

  const purchase = createOrderAnalyticsEvent(ANALYTICS_EVENTS.purchaseCompleted, "order-7", {
    plan: "credits-100",
  });
  assert.equal(purchase.params.order_id, "order-7");
  assert.equal(purchase.params.event_id, "purchase_completed:order:order-7");

  const consumed = createCreditsAnalyticsEvent(ANALYTICS_EVENTS.creditsConsumed, {
    transaction_id: "tx-9",
    credits_before: 10,
    credits_after: 8,
  });
  assert.equal(consumed.params.event_id, "credits_consumed:transaction:tx-9");
});

test("event builders reject task/payment facts without their dedupe subject", () => {
  assert.throws(
    () => createAnalyticsEvent(ANALYTICS_EVENTS.taskFailed),
    /requires task_id/,
  );
  assert.throws(
    () => createAnalyticsEvent(ANALYTICS_EVENTS.purchaseFailed),
    /requires order_id/,
  );
});

test("server event sink receives exactly the event emitted", async () => {
  const received: unknown[] = [];
  const event = createTaskAnalyticsEvent(ANALYTICS_EVENTS.taskProcessing, "task-1");

  const result = await emitServerAnalyticsEvent(event, (value) => {
    received.push(value);
  });

  assert.equal(result, event);
  assert.deepEqual(received, [event]);
});

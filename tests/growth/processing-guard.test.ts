import assert from "node:assert/strict";
import test from "node:test";

import {
  acquireProcessingLease,
  getActiveProcessingCount,
  ProcessingTimeoutError,
  runWithinProcessingDeadline,
} from "../../lib/processing-guard";

test("processing leases enforce the configured capacity and release idempotently", () => {
  const key = `test-processing-${Date.now()}-${Math.random()}`;
  const first = acquireProcessingLease(key, 2);
  const second = acquireProcessingLease(key, 2);
  const third = acquireProcessingLease(key, 2);

  assert.ok(first);
  assert.ok(second);
  assert.equal(third, null);
  assert.equal(getActiveProcessingCount(key), 2);

  first!.release();
  first!.release();
  assert.equal(getActiveProcessingCount(key), 1);

  const replacement = acquireProcessingLease(key, 2);
  assert.ok(replacement);
  assert.equal(getActiveProcessingCount(key), 2);
  second!.release();
  replacement!.release();
  assert.equal(getActiveProcessingCount(key), 0);
});

test("processing work fails at the declared deadline", async () => {
  const deadline = Date.now() + 10;
  await assert.rejects(
    runWithinProcessingDeadline(
      () => new Promise<string>(() => undefined),
      deadline,
    ),
    (error: unknown) => error instanceof ProcessingTimeoutError,
  );
});

test("work that finishes before its deadline returns its value", async () => {
  const value = await runWithinProcessingDeadline(
    async () => "done",
    Date.now() + 1_000,
  );
  assert.equal(value, "done");
});

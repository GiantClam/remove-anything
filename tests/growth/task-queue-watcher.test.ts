import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { setImmediate as nextEventLoopTurn } from "node:timers/promises";

import {
  deferNextProviderStatusRead,
  releaseProviderStatusReads,
  resetWatcherState,
  watcherState as state,
} from "../support/task-queue-watcher-stubs";

const managerPromise = import("../../lib/task-queue");

async function waitFor(predicate: () => boolean, description: string) {
  const deadline = performance.now() + 5_000;
  while (!predicate()) {
    assert.ok(performance.now() < deadline, `Timed out waiting for ${description}`);
    await nextEventLoopTurn();
  }
}

async function stopWatchersAndReleaseReads() {
  const manager = (await managerPromise).taskQueueManager;
  for (const id of manager.getActiveWatchers().taskIds) manager.stopStatusWatcher(id);
  releaseProviderStatusReads();
  await waitFor(() => state.activeRefreshes === 0, "in-flight provider reads to settle");
  // Drain the poll's continuation after its provider promise settles. Stopping
  // first ensures an interrupted test cannot persist or schedule another poll.
  await nextEventLoopTurn();
}

beforeEach(async () => {
  await stopWatchersAndReleaseReads();
  resetWatcherState();
  const manager = (await managerPromise).taskQueueManager;
  (manager as any).watcherConfig.intervalMs = 2;
  (manager as any).watcherConfig.maxMinutes = 15;
});

afterEach(stopWatchersAndReleaseReads);

test("a watcher never overlaps provider reads and duplicate starts reuse one loop", async (t) => {
  const manager = (await managerPromise).taskQueueManager;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const firstRead = deferNextProviderStatusRead();
  const secondRead = deferNextProviderStatusRead();
  manager.startStatusWatcher(17, "watcher-background", "background-removal");
  manager.startStatusWatcher(17, "watcher-background", "background-removal");
  await waitFor(() => firstRead.started, "the first provider read to start");
  await nextEventLoopTurn();
  assert.equal(manager.getActiveWatchers().count, 1);
  assert.equal(state.providerStatusCalls, 1);

  // Offer many polling intervals while the first read is blocked. A competing
  // timer or duplicate loop would enter the second gate before the first ends.
  t.mock.timers.tick(100);
  await nextEventLoopTurn();
  assert.equal(state.providerStatusCalls, 1);
  assert.equal(secondRead.started, false);
  assert.equal(state.activeRefreshes, 1);
  assert.equal(state.maxActiveRefreshes, 1);

  firstRead.release();
  await waitFor(() => state.updates === 1, "the first poll to persist");
  await nextEventLoopTurn();
  t.mock.timers.tick(2);
  await waitFor(() => secondRead.started, "the next scheduled provider read");
  assert.equal(state.providerStatusCalls, 2);
  assert.equal(state.maxActiveRefreshes, 1);
});

test("a callback terminal result wins the in-flight poll CAS", async () => {
  const manager = (await managerPromise).taskQueueManager;
  state.beforeBackgroundUpdate = () => {
    state.background!.taskStatus = "succeeded";
    state.background!.outputImageUrl = "https://storage.example.test/background-removal/processed/webhook.png";
  };
  manager.startStatusWatcher(17, "watcher-background", "background-removal");
  await waitFor(() => manager.getActiveWatchers().count === 0, "the callback result to stop its watcher");
  assert.equal(state.background!.taskStatus, "succeeded");
  assert.equal(state.background!.outputImageUrl, "https://storage.example.test/background-removal/processed/webhook.png");
  assert.equal(state.updates, 0);
  assert.equal(manager.getActiveWatchers().count, 0);
});

test("missing provider output keeps the task processing and watcher recoverable", async () => {
  const manager = (await managerPromise).taskQueueManager;
  state.providerStatus = "SUCCESS";
  state.providerOutput = null;
  manager.startStatusWatcher(17, "watcher-background", "background-removal");
  await waitFor(() => state.providerResultCalls >= 1 && state.updates >= 1, "the missing output poll to persist");
  assert.equal(state.background!.taskStatus, "processing");
  assert.equal(state.background!.outputImageUrl, null);
  assert.equal(manager.getActiveWatchers().count, 1);
  state.providerOutput = "https://provider.example.test/recovered.png";
  await waitFor(() => manager.getActiveWatchers().count === 0, "the recovered result to stop its watcher");
  assert.equal(state.background!.taskStatus, "succeeded");
  assert.equal(state.background!.outputImageUrl, "https://storage.example.test/background-removal/processed/private-result.png");
});

test("private persistence failure does not mark success or stop the watcher", async () => {
  const manager = (await managerPromise).taskQueueManager;
  state.providerStatus = "SUCCESS";
  state.persistError = true;
  manager.startStatusWatcher(17, "watcher-background", "background-removal");
  await waitFor(() => state.persistCalls >= 2, "private persistence failure to be retried");
  assert.equal(state.background!.taskStatus, "processing");
  assert.equal(state.background!.outputImageUrl, null);
  assert.equal(manager.getActiveWatchers().count, 1);
});

test("generic success without output stays recoverable instead of succeeded", async () => {
  const manager = (await managerPromise).taskQueueManager;
  state.generic!.taskStatus = "processing";
  state.providerStatus = "SUCCESS";
  state.providerOutput = null;
  manager.startStatusWatcher(17, "watcher-generic", "image");
  await waitFor(() => state.providerResultCalls >= 1 && state.updates >= 1, "the generic missing output poll to persist");
  assert.equal(state.generic!.taskStatus, "processing");
  assert.equal(state.generic!.imageUrl, null);
  assert.equal(manager.getActiveWatchers().count, 1);
});

test("generic status transitions emit processing lifecycle events once with the app task id", async () => {
  const manager = (await managerPromise).taskQueueManager;
  state.generic!.taskStatus = "pending";
  state.providerStatus = "RUNNING";
  manager.startStatusWatcher(17, "watcher-generic", "image");
  await waitFor(
    () => state.analyticsEvents.some((event) => event.name === "processing_started"),
    "processing start analytics",
  );

  state.providerStatus = "SUCCESS";
  await waitFor(() => manager.getActiveWatchers().count === 0, "successful task completion");
  assert.deepEqual(
    state.analyticsEvents.map((event) => event.name),
    ["processing_started", "processing_completed"],
  );
  assert.deepEqual(
    state.analyticsEvents.map((event) => event.params.task_id),
    ["17", "17"],
  );
});

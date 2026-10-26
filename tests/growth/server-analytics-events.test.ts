import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import {
  ANALYTICS_EVENTS,
  createTaskAnalyticsEvent,
} from "../../lib/analytics-events";

type CreateArgs = { data: Record<string, unknown> };
type SinkMode = "ok" | "duplicate" | "failure";

const state: { mode: SinkMode; calls: CreateArgs[] } = {
  mode: "ok",
  calls: [],
};

(
  globalThis as typeof globalThis & { __TEST_PRISMA__?: unknown }
).__TEST_PRISMA__ = {
  analyticsEvent: {
    create: async (args: CreateArgs) => {
      state.calls.push(args);
      if (state.mode === "duplicate") {
        const error = new Error("duplicate event");
        Object.assign(error, { code: "P2002" });
        throw error;
      }
      if (state.mode === "failure") throw new Error("sink unavailable");
      return { eventId: args.data.eventId };
    },
  },
};

process.env.ANALYTICS_DURABLE_SINK = "true";
const serverAnalyticsPromise = import("../../lib/server-analytics-events");

beforeEach(() => {
  state.mode = "ok";
  state.calls = [];
});

after(() => {
  delete process.env.ANALYTICS_DURABLE_SINK;
});

test("server durable sink maps event fields and payload to one Prisma row", async () => {
  const { emitServerAnalyticsEvent } = await serverAnalyticsPromise;
  const event = createTaskAnalyticsEvent(
    ANALYTICS_EVENTS.taskSucceeded,
    "server-sink-task",
    {
      tool_slug: "remove-background",
      locale: "en",
      is_authenticated: true,
    },
  );

  const result = await emitServerAnalyticsEvent(event);

  assert.equal(result, event);
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.calls[0].data, {
    eventId: "task_succeeded:task:remove-background:server-sink-task",
    name: "task_succeeded",
    taskId: "server-sink-task",
    orderId: undefined,
    userId: undefined,
    toolSlug: "remove-background",
    landingPage: undefined,
    locale: "en",
    fileType: undefined,
    fileSizeBucket: undefined,
    isAuthenticated: true,
    plan: undefined,
    creditsBefore: undefined,
    creditsAfter: undefined,
    experimentId: undefined,
    payload: {
      event_id: "task_succeeded:task:remove-background:server-sink-task",
      task_id: "server-sink-task",
      tool_slug: "remove-background",
      locale: "en",
      is_authenticated: true,
    },
  });
});

test("server durable sink swallows duplicate delivery and provider errors", async () => {
  const { emitServerAnalyticsEvent } = await serverAnalyticsPromise;
  const event = createTaskAnalyticsEvent(
    ANALYTICS_EVENTS.taskProcessing,
    "server-sink-retry",
  );

  state.mode = "duplicate";
  await assert.doesNotReject(() => emitServerAnalyticsEvent(event));

  state.mode = "failure";
  await assert.doesNotReject(() => emitServerAnalyticsEvent(event));
  assert.equal(state.calls.length, 2);
});

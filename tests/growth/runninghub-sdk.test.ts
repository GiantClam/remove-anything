import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

process.env.RUNNINGHUB_API_BASE_URL = "https://provider.example.test";
process.env.RUNNINGHUB_API_KEY = "test-key";
const sdkPromise = import("../../modules/runninghub/sdk");
const originalFetch = globalThis.fetch;
const originalSecret = process.env.RUNNINGHUB_WEBHOOK_SECRET;
const originalSite = process.env.NEXTAUTH_URL;
beforeEach(() => {
  process.env.RUNNINGHUB_WEBHOOK_SECRET =
    "test-sdk-callback-secret-at-least-32-characters";
  process.env.NEXTAUTH_URL = "https://remove-anything.test";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  originalSecret === undefined
    ? delete process.env.RUNNINGHUB_WEBHOOK_SECRET
    : (process.env.RUNNINGHUB_WEBHOOK_SECRET = originalSecret);
  originalSite === undefined
    ? delete process.env.NEXTAUTH_URL
    : (process.env.NEXTAUTH_URL = originalSite);
});
const options = {
  workflowId: "workflow",
  nodeInfoList: [],
  taskRecordId: 42,
  webhookRecordType: "video" as const,
};
async function sdk() {
  const { RunningHubAPI } = await sdkPromise;
  return new RunningHubAPI({
    baseUrl: "https://provider.example.test",
    apiKey: "test-key",
  });
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("provider create succeeds once and includes the task callback reference", async () => {
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const payload = JSON.parse(String(init?.body));
    const callback = new URL(payload.webhookUrl);
    assert.equal(callback.origin, "https://remove-anything.test");
    assert.equal(callback.pathname, "/api/webhooks/runninghub");
    assert.equal(
      callback.searchParams.get("key"),
      process.env.RUNNINGHUB_WEBHOOK_SECRET,
    );
    assert.equal(callback.searchParams.get("recordId"), "42");
    assert.equal(callback.searchParams.get("recordType"), "video");
    assert.ok(init?.signal);
    return response({ code: 0, msg: "success", data: { taskId: "task-1" } });
  };
  assert.equal(await (await sdk()).createTaskGeneric(options), "task-1");
  assert.equal(calls, 1);
});

test("missing callback secret or insecure site leaves polling available without an unauthenticated webhook", async () => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).webhookUrl, undefined);
    return response({ code: 0, data: { taskId: "poll-only" } });
  };
  delete process.env.RUNNINGHUB_WEBHOOK_SECRET;
  assert.equal(await (await sdk()).createTaskGeneric(options), "poll-only");
  process.env.RUNNINGHUB_WEBHOOK_SECRET =
    "test-sdk-callback-secret-at-least-32-characters";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  assert.equal(await (await sdk()).createTaskGeneric(options), "poll-only");
});

test("R2 task creation uses the same authenticated callback URL", async () => {
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(String(init?.body));
    assert.equal(
      new URL(payload.webhookUrl).searchParams.get("key"),
      process.env.RUNNINGHUB_WEBHOOK_SECRET,
    );
    return response({ code: 0, data: { taskId: "video-1" } });
  };
  assert.equal(
    await (
      await sdk()
    ).createTaskWithR2Url({
      ...options,
      r2Url: "https://r2.example.test/source",
    }),
    "video-1",
  );
});

test("provider errors cannot expose the callback bearer secret through SDK errors", async () => {
  const secret = process.env.RUNNINGHUB_WEBHOOK_SECRET!;
  globalThis.fetch = async () =>
    response({ code: 403, msg: `rejected callback key=${secret}` });
  await assert.rejects(
    (await sdk()).createTaskGeneric(options),
    (error: any) =>
      error.code === "TASK_CREATION_OUTCOME_UNKNOWN" &&
      !error.message.includes(secret),
  );
  globalThis.fetch = async () =>
    new Response(`callback key=${encodeURIComponent(secret)}`, { status: 400 });
  await assert.rejects(
    (await sdk()).createTaskWithR2Url({
      ...options,
      r2Url: "https://r2.example.test/source",
    }),
    (error: Error) =>
      error.message.includes("[redacted]") && !error.message.includes(secret),
  );
});

test("one automatic retry is allowed only after an explicit capacity rejection", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? response({ code: 421, msg: "TASK_QUEUE_MAXED" })
      : response({ code: 0, data: { taskId: "task-2" } });
  };
  assert.equal(await (await sdk()).createTaskGeneric(options), "task-2");
  assert.equal(calls, 2);
});

test("TASK_INSTANCE_MAXED receives the same single explicit-rejection retry", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? response({ code: 415, msg: "TASK_INSTANCE_MAXED" })
      : response({ code: 0, data: { taskId: "task-instance-retry" } });
  };
  assert.equal(
    await (await sdk()).createTaskGeneric(options),
    "task-instance-retry",
  );
  assert.equal(calls, 2);
});

test("explicit capacity rejection stops after one automatic retry", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response({ code: 421, msg: "TASK_QUEUE_MAXED" });
  };
  await assert.rejects(
    (await sdk()).createTaskGeneric(options),
    (error: any) =>
      error.code === "TASK_CREATION_REJECTED" &&
      error.taskWasNotCreated === true,
  );
  assert.equal(calls, 2);
});

test("network failure leaves creation outcome unknown and never replays create", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("fetch failed TASK_QUEUE_MAXED");
  };
  await assert.rejects(
    (await sdk()).createTaskGeneric(options),
    (error: any) =>
      error.code === "TASK_CREATION_OUTCOME_UNKNOWN" &&
      error.recoverable === true,
  );
  assert.equal(calls, 1);
});

test("HTTP 502 cannot trigger a second provider creation even when its body names capacity", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response({ code: 421, msg: "TASK_QUEUE_MAXED" }, 502);
  };
  await assert.rejects(
    (await sdk()).createTaskGeneric(options),
    (error: any) => error.code === "TASK_CREATION_OUTCOME_UNKNOWN",
  );
  assert.equal(calls, 1);
});

test("invalid JSON and missing task identifiers fail closed without another job", async () => {
  for (const result of [
    () => new Response("invalid json"),
    () => response(null),
    () => response({ code: 0, data: {} }),
  ]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return result();
    };
    await assert.rejects(
      (await sdk()).createTaskGeneric(options),
      (error: any) => error.code === "TASK_CREATION_OUTCOME_UNKNOWN",
    );
    assert.equal(calls, 1);
  }
});

test("non-capacity provider errors are unknown and never retried", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response({ code: 403, msg: "INVALID_WORKFLOW" });
  };
  await assert.rejects(
    (await sdk()).createTaskGeneric(options),
    (error: any) => error.code === "TASK_CREATION_OUTCOME_UNKNOWN",
  );
  assert.equal(calls, 1);
});

test("a capacity response with a task id is ambiguous and never retried", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return response({
      code: 421,
      msg: "TASK_QUEUE_MAXED",
      data: { taskId: "possibly-created" },
    });
  };
  await assert.rejects(
    (await sdk()).createTaskGeneric(options),
    (error: any) => error.code === "TASK_CREATION_OUTCOME_UNKNOWN",
  );
  assert.equal(calls, 1);
});

test("malformed capacity response data is unknown and never retried", async () => {
  for (const data of [false, [], { taskId: 0 }, { taskId: false }]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return response({ code: 421, msg: "TASK_QUEUE_MAXED", data });
    };
    await assert.rejects(
      (await sdk()).createTaskGeneric(options),
      (error: any) => error.code === "TASK_CREATION_OUTCOME_UNKNOWN",
    );
    assert.equal(calls, 1);
  }
});

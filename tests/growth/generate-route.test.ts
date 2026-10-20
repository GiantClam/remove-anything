import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import {
  generateRoutePrisma,
  resetGenerateRouteState,
  generateRouteState as state,
} from "../support/generate-route-stubs";
import { TINY_PNG_BYTES } from "../support/image-fixtures";

(process.env as unknown as Record<string, string>).NODE_ENV = "test";
process.env.ANONYMOUS_PRINCIPAL_SECRET = "generate-route-test-secret";
(
  globalThis as typeof globalThis & { __TEST_PRISMA__?: unknown }
).__TEST_PRISMA__ = generateRoutePrisma;

const routePromise = import("../../app/api/generate/route");

const originalFetch = globalThis.fetch;
const previousAllowedOrigins = process.env.IMAGE_INPUT_ALLOWED_ORIGINS;
let inputFetchCalls = 0;
beforeEach(() => {
  resetGenerateRouteState();
  process.env.IMAGE_INPUT_ALLOWED_ORIGINS = "https://input.example.test";
  inputFetchCalls = 0;
  globalThis.fetch = async () => {
    inputFetchCalls++;
    return new Response(TINY_PNG_BYTES, {
      headers: { "content-type": "image/png" },
    });
  };
});
after(() => {
  globalThis.fetch = originalFetch;
  if (previousAllowedOrigins === undefined)
    delete process.env.IMAGE_INPUT_ALLOWED_ORIGINS;
  else process.env.IMAGE_INPUT_ALLOWED_ORIGINS = previousAllowedOrigins;
});

const serialTest = (name: string, fn: () => Promise<void>) =>
  test(name, { concurrency: false }, async (t) => {
    t.mock.method(console, "log", () => {});
    t.mock.method(console, "error", () => {});
    await fn();
  });

function request(
  idempotencyKey: string,
  image = "https://input.example.test/source.png",
) {
  return new NextRequest("https://remove-anything.test/api/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ image }),
  });
}

async function post(idempotencyKey: string, image?: string) {
  const { POST } = await routePromise;
  return POST(request(idempotencyKey, image));
}

serialTest(
  "an authenticated zero-balance user can create a free task within the monthly allowance",
  async () => {
    state.creditBalance = 0;
    const response = await post("free-task-1");
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.status, "processing");
    assert.equal(data.taskId, "runninghub-1");
    assert.equal(state.providerCreateCalls, 1);
    assert.equal(state.tasks.length, 1);
    assert.equal(state.tasks[0].taskStatus, "processing");
    assert.deepEqual(state.providerReservationStates, ["queued"]);
    assert.deepEqual(state.transactionIsolationLevels, ["Serializable"]);
    assert.equal(state.creditBalance, 0);
    assert.equal(state.creditReads, 0);
    assert.equal(state.creditWrites.length, 0);
    assert.equal(state.billingWrites.length, 0);
    assert.equal(state.creditTransactionWrites.length, 0);
  },
);

serialTest("quota rejection happens before provider creation", async () => {
  state.quotaCounts.backgroundRemovalTask = 2;
  state.quotaCounts.watermarkRemovalTask = 1;
  state.quotaCounts.objectRemovalTask = 1;
  state.quotaCounts.taskData = 1;
  const response = await post("over-quota");
  const data = await response.json();

  assert.equal(response.status, 429);
  assert.equal(data.code, "QUOTA_EXCEEDED");
  assert.equal(state.providerCreateCalls, 0);
  assert.equal(state.tasks.length, 0);
  assert.equal(state.creditReads, 0);
});

serialTest(
  "a matching idempotency key returns the existing task without a second provider job",
  async () => {
    state.quotaCounts.watermarkRemovalTask = 4;
    const first = await post("same-request");
    const firstData = await first.json();
    const second = await post("same-request");
    const secondData = await second.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(secondData.idempotent, true);
    assert.equal(secondData.taskId, firstData.taskId);
    assert.equal(secondData.taskRecordId, firstData.taskRecordId);
    assert.equal(state.providerCreateCalls, 1);
    assert.equal(state.tasks.length, 1);
    assert.equal(
      state.quotaReads,
      4,
      "an idempotent request must bypass the now-full allowance",
    );
    assert.equal(
      inputFetchCalls,
      1,
      "reusing a task must not re-read its remote input",
    );
  },
);

serialTest(
  "provider setup failure marks the reservation failed and releases the free slot",
  async () => {
    state.quotaCounts.watermarkRemovalTask = 4;
    state.providerError = new Error("provider unavailable");
    const failed = await post("provider-failure");
    const failedData = await failed.json();

    assert.equal(failed.status, 500);
    assert.match(failedData.error, /provider unavailable/);
    assert.equal(state.providerCreateCalls, 1);
    assert.equal(state.tasks[0].taskStatus, "failed");
    assert.ok(state.tasks[0].executeEndTime);
    assert.equal(
      state.providerCancelCalls,
      0,
      "a failed creation returned no provider task to cancel",
    );

    state.providerError = null;
    const retry = await post("provider-failure");
    assert.equal(retry.status, 200);
    assert.equal(state.providerCreateCalls, 2);
    assert.equal(state.tasks.length, 2);
    assert.equal(state.tasks[1].taskStatus, "processing");
    assert.equal(state.billingWrites.length, 0);
    assert.equal(state.creditTransactionWrites.length, 0);
  },
);

serialTest(
  "a free task never creates a Withdraw or changes an existing credit balance",
  async () => {
    state.creditBalance = 50;
    const response = await post("free-with-existing-credits");

    assert.equal(response.status, 200);
    assert.equal(state.providerCreateCalls, 1);
    assert.equal(state.creditBalance, 50);
    assert.equal(state.creditReads, 0);
    assert.deepEqual(state.creditWrites, []);
    assert.deepEqual(state.billingWrites, []);
    assert.deepEqual(state.creditTransactionWrites, []);
  },
);

serialTest(
  "an uncertain provider outcome keeps its allowance and blocks an automatic duplicate",
  async () => {
    state.quotaCounts.watermarkRemovalTask = 4;
    state.providerError = Object.assign(
      new Error("provider request timed out"),
      { code: "TASK_CREATION_OUTCOME_UNKNOWN" },
    );

    const uncertain = await post("uncertain-creation");
    const uncertainData = await uncertain.json();
    assert.equal(uncertain.status, 503);
    assert.equal(uncertainData.code, "TASK_CREATION_OUTCOME_UNKNOWN");
    assert.equal(state.tasks[0].taskStatus, "queued");
    assert.equal(state.tasks[0].executeEndTime, null);

    state.providerError = null;
    const retry = await post("uncertain-creation");
    const retryData = await retry.json();
    assert.equal(retry.status, 409);
    assert.equal(retryData.code, "TASK_STARTING");
    assert.equal(retry.headers.get("retry-after"), "2");
    assert.equal(state.providerCreateCalls, 1);
    assert.equal(state.providerCancelCalls, 0);
    assert.equal(state.tasks.length, 1);
  },
);

serialTest(
  "provider activation preserves a terminal callback that arrived during creation",
  async () => {
    state.beforeProviderReturn = () => {
      state.tasks[0].taskStatus = "succeeded";
      state.tasks[0].outputImageUrl =
        "https://files.example.test/callback-result.png";
      state.tasks[0].executeEndTime = BigInt(Date.now());
    };
    const response = await post("fast-provider-callback");

    assert.equal(response.status, 200);
    assert.equal(state.tasks[0].replicateId, "runninghub-1");
    assert.equal(state.tasks[0].taskStatus, "succeeded");
    assert.equal(
      state.tasks[0].outputImageUrl,
      "https://files.example.test/callback-result.png",
    );
    assert.equal(state.providerCancelCalls, 0);
  },
);

serialTest(
  "an upload denied by the free quota does not upload to R2 or create a provider job",
  async () => {
    state.quotaCounts.objectRemovalTask = 5;
    const body = new FormData();
    body.set(
      "image",
      new File([new Uint8Array([137, 80, 78, 71])], "source.png", {
        type: "image/png",
      }),
    );
    const { POST } = await routePromise;
    const response = await POST(
      new NextRequest("https://remove-anything.test/api/generate", {
        method: "POST",
        headers: { "idempotency-key": "quota-denied-upload" },
        body,
      }),
    );
    const data = await response.json();

    assert.equal(response.status, 429);
    assert.equal(data.code, "QUOTA_EXCEEDED");
    assert.equal(state.r2UploadCalls, 0);
    assert.equal(state.providerCreateCalls, 0);
    assert.equal(state.tasks.length, 0);
  },
);

serialTest(
  "untrusted remote inputs fail before any fetch or provider side effect",
  async () => {
    const response = await post(
      "untrusted-url",
      "https://untrusted.example.test/source.png",
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "UNTRUSTED_IMAGE_URL");
    assert.equal(inputFetchCalls, 0);
    assert.equal(state.providerCreateCalls, 0);
    assert.equal(state.r2UploadCalls, 0);
    assert.equal(state.tasks[0].taskStatus, "failed");
  },
);

serialTest(
  "oversized remote inputs return their free slot before provider creation",
  async () => {
    globalThis.fetch = async () =>
      new Response(TINY_PNG_BYTES, {
        headers: { "content-type": "image/png", "content-length": "10485761" },
      });
    const response = await post("oversized-input");
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, "FILE_TOO_LARGE");
    assert.equal(state.providerCreateCalls, 0);
    assert.equal(state.tasks[0].taskStatus, "failed");
  },
);

serialTest(
  "multipart image bytes are decoded before storage and provider use",
  async () => {
    const { POST } = await routePromise;
    for (const [bytes, status] of [
      [new TextEncoder().encode("<svg></svg>"), 415],
      [TINY_PNG_BYTES, 200],
    ] as const) {
      const body = new FormData();
      body.set("image", new File([bytes], "source.png", { type: "image/png" }));
      const response = await POST(
        new NextRequest("https://remove-anything.test/api/generate", {
          method: "POST",
          headers: { "idempotency-key": `decoded-upload-${status}` },
          body,
        }),
      );
      assert.equal(response.status, status);
      if (status === 415) {
        assert.equal((await response.json()).code, "UNSUPPORTED_IMAGE_FORMAT");
        assert.equal(state.r2UploadCalls, 0);
        assert.equal(state.providerCreateCalls, 0);
        assert.equal(state.tasks[0].taskStatus, "failed");
      } else {
        assert.equal(state.r2UploadCalls, 1);
        assert.equal(state.providerCreateCalls, 1);
      }
    }
  },
);

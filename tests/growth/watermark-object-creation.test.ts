import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import { TINY_PNG_BYTES, WIDE_PNG_BYTES } from "../support/image-fixtures";
import {
  imageTaskRouteState,
  resetImageTaskRouteState,
} from "../support/image-task-route-stubs";

(process.env as unknown as Record<string, string>).NODE_ENV = "test";
process.env.ANONYMOUS_PRINCIPAL_SECRET = "image-route-test-secret";
const prismaState = {
  watermarkRemovalTask: [] as any[],
  objectRemovalTask: [] as any[],
};
let nextId = 1;
function resetPrisma() {
  prismaState.watermarkRemovalTask.length = 0;
  prismaState.objectRemovalTask.length = 0;
  nextId = 1;
}
function model(name: "watermarkRemovalTask" | "objectRemovalTask") {
  return {
    count: async ({ where }: any) =>
      prismaState[name].filter(
        (row) =>
          (row.userId ?? row.principalId) ===
            (where.userId ?? where.principalId) &&
          where.taskStatus.in.includes(row.taskStatus),
      ).length,
    findFirst: async ({ where }: any) =>
      prismaState[name].find(
        (row) =>
          row.idempotencyKey === where.idempotencyKey &&
          (where.userId === undefined || row.userId === where.userId) &&
          (where.principalId === undefined ||
            row.principalId === where.principalId) &&
          !where.taskStatus.notIn.includes(row.taskStatus),
      ) || null,
    create: async ({ data }: any) => {
      const row = { id: nextId++, createdAt: new Date(), ...data };
      prismaState[name].push(row);
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      const row = prismaState[name].find(
        (candidate) =>
          candidate.id === where.id &&
          (typeof where.taskStatus === "string"
            ? where.taskStatus === candidate.taskStatus
            : where.taskStatus.in.includes(candidate.taskStatus)),
      );
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
    update: async ({ where, data }: any) => {
      const row = prismaState[name].find(
        (candidate) => candidate.id === where.id,
      );
      Object.assign(row, data);
      return row;
    },
  };
}
const prismaFake: any = {
  watermarkRemovalTask: model("watermarkRemovalTask"),
  objectRemovalTask: model("objectRemovalTask"),
  backgroundRemovalTask: { count: async () => 0 },
  taskData: { count: async () => 0 },
};
prismaFake.$transaction = async (callback: (tx: any) => Promise<unknown>) =>
  callback(prismaFake);
(globalThis as any).__TEST_PRISMA__ = prismaFake;
const watermarkRoute = import("../../app/api/watermark-removal/route");
const objectRoute = import("../../app/api/remove-objects/route");
const originalFetch = globalThis.fetch;
const originalAllowedOrigins = process.env.IMAGE_INPUT_ALLOWED_ORIGINS;
let fetchCalls = 0;
beforeEach(() => {
  resetPrisma();
  resetImageTaskRouteState();
  process.env.IMAGE_INPUT_ALLOWED_ORIGINS = "https://a.test";
  fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    return new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
  };
});
after(() => {
  globalThis.fetch = originalFetch;
  if (originalAllowedOrigins === undefined)
    delete process.env.IMAGE_INPUT_ALLOWED_ORIGINS;
  else process.env.IMAGE_INPUT_ALLOWED_ORIGINS = originalAllowedOrigins;
});

function watermarkRequest(body: Record<string, unknown>, key = "wm-key") {
  return new NextRequest("https://remove-anything.test/api/watermark-removal", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  });
}
function objectRequest(body: Record<string, unknown>, key = "obj-key") {
  return new NextRequest("https://remove-anything.test/api/remove-objects", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  });
}

test("watermark free path rejects multi-image paid output and never reserves", async () => {
  const { POST } = await watermarkRoute;
  const response = await POST(
    watermarkRequest({
      imageUrls: ["https://a.test/a.png", "https://a.test/b.png"],
      authorizationConfirmed: true,
    }),
  );
  assert.equal(response.status, 402);
  assert.equal((await response.json()).code, "PAID_OUTPUT_UNAVAILABLE");
  assert.equal(prismaState.watermarkRemovalTask.length, 0);
});

test("watermark provider failure marks the queued reservation failed", async () => {
  const { POST } = await watermarkRoute;
  imageTaskRouteState.providerError = new Error("provider unavailable");
  const response = await POST(
    watermarkRequest({
      imageUrls: ["https://a.test/a.png"],
      authorizationConfirmed: true,
    }),
  );
  assert.equal(response.status, 500);
  assert.equal(imageTaskRouteState.providerCreateCalls, 1);
  assert.equal(prismaState.watermarkRemovalTask[0].taskStatus, "failed");
});

test("object idempotent retry never creates a second provider task", async () => {
  const { POST } = await objectRoute;
  imageTaskRouteState.user = { id: "user-1" };
  const body = {
    imageUrl: "https://a.test/a.png",
    maskUrl: "https://a.test/mask.png",
    authorizationConfirmed: true,
  };
  const first = await POST(objectRequest(body, "same-object"));
  const originalFetchCalls = fetchCalls;
  const second = await POST(objectRequest(body, "same-object"));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const secondData = await second.json();
  assert.equal(secondData.idempotent, true);
  assert.equal(imageTaskRouteState.providerCreateCalls, 1);
  assert.equal(prismaState.objectRemovalTask.length, 1);
  assert.equal(fetchCalls, originalFetchCalls);
});

test("watermark upload failure releases the reserved free allowance", async () => {
  const { POST } = await watermarkRoute;
  imageTaskRouteState.user = { id: "upload-owner" };
  imageTaskRouteState.uploadError = new Error("storage unavailable");
  const body = {
    imageUrls: ["https://a.test/a.png"],
    authorizationConfirmed: true,
  };
  const failed = await POST(watermarkRequest(body));
  assert.equal(failed.status, 500);
  assert.equal(imageTaskRouteState.uploadCalls, 1);
  assert.equal(imageTaskRouteState.providerCreateCalls, 0);
  assert.equal(prismaState.watermarkRemovalTask[0].taskStatus, "failed");
  imageTaskRouteState.uploadError = null;
  assert.equal((await POST(watermarkRequest(body))).status, 200);
  assert.equal(prismaState.watermarkRemovalTask.length, 2);
});

test("watermark same-key request reuses the active task before quota or upload", async () => {
  const { POST } = await watermarkRoute;
  imageTaskRouteState.user = { id: "watermark-owner" };
  const body = {
    imageUrls: ["https://a.test/a.png"],
    authorizationConfirmed: true,
  };
  assert.equal((await POST(watermarkRequest(body, "wm-same"))).status, 200);
  const uploadCalls = imageTaskRouteState.uploadCalls;
  const originalFetchCalls = fetchCalls;
  const response = await POST(watermarkRequest(body, "wm-same"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).idempotent, true);
  assert.equal(imageTaskRouteState.providerCreateCalls, 1);
  assert.equal(imageTaskRouteState.uploadCalls, uploadCalls);
  assert.equal(fetchCalls, originalFetchCalls);
});

test("unknown provider outcomes keep the reservation and never start another same-key job", async () => {
  const { POST } = await objectRoute;
  imageTaskRouteState.user = { id: "unknown-owner" };
  imageTaskRouteState.providerError = Object.assign(
    new Error("Check original task"),
    { code: "TASK_CREATION_OUTCOME_UNKNOWN" },
  );
  const body = {
    imageUrl: "https://a.test/a.png",
    maskUrl: "https://a.test/mask.png",
    authorizationConfirmed: true,
  };
  const first = await POST(objectRequest(body, "unknown-key"));
  assert.equal(first.status, 503);
  assert.equal((await first.json()).code, "TASK_CREATION_OUTCOME_UNKNOWN");
  assert.equal(prismaState.objectRemovalTask[0].taskStatus, "queued");
  const retry = await POST(objectRequest(body, "unknown-key"));
  assert.equal(retry.status, 409);
  assert.equal((await retry.json()).code, "TASK_STARTING");
  assert.equal(retry.headers.get("retry-after"), "2");
  assert.equal(imageTaskRouteState.providerCreateCalls, 1);
});

test("remote watermark input is size limited and unsupported input never reaches storage", async () => {
  const { POST } = await watermarkRoute;
  const headerCases: Record<string, string>[] = [
    { "content-length": "10485761", "content-type": "image/png" },
    { "content-type": "image/gif" },
  ];
  for (const headers of headerCases) {
    resetPrisma();
    resetImageTaskRouteState();
    globalThis.fetch = async () =>
      new Response(new Uint8Array([1, 2, 3]), { headers });
    const response = await POST(
      watermarkRequest({
        imageUrls: ["https://a.test/a.png"],
        authorizationConfirmed: true,
      }),
    );
    assert.equal(response.status, "content-length" in headers ? 413 : 415);
    assert.equal(imageTaskRouteState.uploadCalls, 0);
    assert.equal(prismaState.watermarkRemovalTask[0].taskStatus, "failed");
  }
});

test("watermark rejects untrusted origins and forged file MIME before storage/provider work", async () => {
  const { POST } = await watermarkRoute;
  const denied = await POST(
    watermarkRequest({
      imageUrls: ["https://untrusted.test/input.png"],
      authorizationConfirmed: true,
    }),
  );
  assert.equal(denied.status, 400);
  assert.equal((await denied.json()).code, "UNTRUSTED_IMAGE_URL");
  assert.equal(fetchCalls, 0);
  assert.equal(prismaState.watermarkRemovalTask[0].taskStatus, "failed");
  const data = new FormData();
  data.set("authorizationConfirmed", "true");
  data.set(
    "images",
    new File([new Uint8Array(TINY_PNG_BYTES)], "spoof.jpg", {
      type: "image/jpeg",
    }),
  );
  const forged = await POST(
    new NextRequest("https://remove-anything.test/api/watermark-removal", {
      method: "POST",
      body: data,
    }),
  );
  assert.equal(forged.status, 415);
  assert.equal(imageTaskRouteState.uploadCalls, 0);
  assert.equal(imageTaskRouteState.providerCreateCalls, 0);
  assert.equal(prismaState.watermarkRemovalTask[1].taskStatus, "failed");
});

test("object rejects untrusted origin, forged MIME, oversized bytes, and mismatched mask dimensions without provider jobs", async () => {
  const { POST } = await objectRoute;
  imageTaskRouteState.user = { id: "invalid-input-owner" };
  const cases = [
    {
      code: "UNTRUSTED_IMAGE_URL",
      status: 400,
      imageUrl: "https://untrusted.test/a.png",
      response: (_url: unknown) =>
        new Response(new Uint8Array(TINY_PNG_BYTES), {
          headers: { "content-type": "image/png" },
        }),
    },
    {
      code: "UNSUPPORTED_IMAGE_FORMAT",
      status: 415,
      imageUrl: "https://a.test/a.png",
      response: (url: unknown) =>
        new Response(new Uint8Array(TINY_PNG_BYTES), {
          headers: {
            "content-type": String(url).includes("a.png")
              ? "image/jpeg"
              : "image/png",
          },
        }),
    },
    {
      code: "FILE_TOO_LARGE",
      status: 413,
      imageUrl: "https://a.test/a.png",
      response: (_url: unknown) =>
        new Response(new Uint8Array(TINY_PNG_BYTES), {
          headers: {
            "content-type": "image/png",
            "content-length": "10485761",
          },
        }),
    },
    {
      code: "MASK_DIMENSIONS_MISMATCH",
      status: 400,
      imageUrl: "https://a.test/a.png",
      response: (url: unknown) =>
        new Response(
          new Uint8Array(
            String(url).includes("m.png") ? WIDE_PNG_BYTES : TINY_PNG_BYTES,
          ),
          { headers: { "content-type": "image/png" } },
        ),
    },
  ];
  for (const [index, entry] of cases.entries()) {
    globalThis.fetch = async (url) => entry.response(url);
    const response = await POST(
      objectRequest(
        {
          imageUrl: entry.imageUrl,
          maskUrl: "https://a.test/m.png",
          authorizationConfirmed: true,
        },
        `invalid-object-${index}`,
      ),
    );
    assert.equal(response.status, entry.status);
    assert.equal((await response.json()).code, entry.code);
    assert.equal(prismaState.objectRemovalTask[index].taskStatus, "failed");
    assert.equal(imageTaskRouteState.providerCreateCalls, 0);
  }
  // Four rejected inputs have returned their reservations, so a valid request
  // still fits the same authenticated free allowance.
  globalThis.fetch = async () =>
    new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
  assert.equal(
    (
      await POST(
        objectRequest(
          {
            imageUrl: "https://a.test/a.png",
            maskUrl: "https://a.test/m.png",
            authorizationConfirmed: true,
          },
          "valid-after-invalid",
        ),
      )
    ).status,
    200,
  );
  assert.equal(imageTaskRouteState.providerCreateCalls, 1);
});

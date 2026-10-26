import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import sharp from "sharp";

import { GET } from "../../app/api/download-object/route";
import {
  ANONYMOUS_PRINCIPAL_COOKIE,
  createAnonymousPrincipal,
  verifyAnonymousPrincipal,
} from "../../lib/task-lifecycle";
import {
  resetDownloadRouteState,
  downloadRouteState as state,
} from "../support/download-route-stubs";

process.env.ANONYMOUS_PRINCIPAL_SECRET = "download-route-test-secret";

const originalFetch = globalThis.fetch;
const fetchCalls: { url: string; options?: RequestInit }[] = [];
let upstreamStatus = 200;
let upstreamContentType: string | null = "image/webp; charset=binary";
let imageBytes = new Uint8Array();

beforeEach(async () => {
  resetDownloadRouteState();
  fetchCalls.length = 0;
  upstreamStatus = 200;
  upstreamContentType = "image/webp; charset=binary";
  imageBytes = new Uint8Array(
    await sharp({
      create: {
        width: 2048,
        height: 1200,
        channels: 4,
        background: { r: 40, g: 120, b: 220, alpha: 1 },
      },
    })
      .webp()
      .toBuffer(),
  );
  state.user = { id: "owner-1" };
  state.task = {
    id: 17,
    userId: "owner-1",
    taskStatus: "succeeded",
    outputImageUrl:
      "https://files.example.test/assets/object/results%20folder/output.webp",
    expiresAt: new Date(Date.now() + 60_000),
  };
  globalThis.fetch = async (input, options) => {
    fetchCalls.push({ url: String(input), options });
    return new Response(imageBytes, {
      status: upstreamStatus,
      headers: upstreamContentType
        ? { "content-type": upstreamContentType }
        : {},
    });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function request(query = "taskId=task-17", cookie?: string) {
  return new NextRequest(
    `https://remove-anything.test/api/download-object?${query}`,
    {
      headers: cookie ? { cookie } : undefined,
    },
  );
}

test("object download rejects missing and unknown tasks before fetching output", async () => {
  const missing = await GET(request(""));
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { error: "Missing taskId parameter" });
  assert.deepEqual(state.lookupIds, []);

  state.task = null;
  const unknown = await GET(request());
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: "Task not found" });
  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(state.signedRequests, []);
});

test("object download rejects another account before signing or fetching", async () => {
  state.user = { id: "other-account" };
  const response = await GET(request());
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "TASK_FORBIDDEN");
  assert.deepEqual(state.signedRequests, []);
  assert.deepEqual(fetchCalls, []);
});

test("object full output stays disabled before signing or fetching", async () => {
  const response = await GET(request("taskId=task-17&output=full"));
  assert.equal(response.status, 402);
  assert.equal((await response.json()).code, "FULL_OUTPUT_NOT_ENABLED");
  assert.deepEqual(state.signedRequests, []);
  assert.deepEqual(fetchCalls, []);
});

test("object download accepts the owner, signs only its R2 key, and caps the image edge", async () => {
  const response = await GET(request("taskId=%20task-17%20"));
  assert.equal(response.status, 200);
  assert.deepEqual(state.lookupIds, ["task-17"]);
  assert.deepEqual(state.signedRequests, [
    {
      key: "object/results folder/output.webp",
      bucket: "unit-test-bucket",
      expiresIn: 60,
    },
  ]);
  assert.equal(fetchCalls[0]?.url, state.signedUrl);
  assert.equal(fetchCalls[0]?.options?.redirect, "error");
  assert.equal(fetchCalls[0]?.options?.cache, "no-store");
  assert.ok(fetchCalls[0]?.options?.signal instanceof AbortSignal);
  const downloaded = new Uint8Array(await response.arrayBuffer());
  const metadata = await sharp(downloaded).metadata();
  assert.ok(metadata.width! <= 1024);
  assert.ok(metadata.height! <= 1024);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="object-removed-task-17.webp"',
  );
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-output-max-edge-px"), "1024");
  assert.equal(response.headers.get("vary"), "Cookie, Authorization");
  assert.deepEqual(state.emittedEvents, [
    {
      name: "result_downloaded",
      params: {
        tool_slug: "remove-objects",
        is_authenticated: true,
        task_id: "17",
        event_id: "result_downloaded:task:remove-objects:17",
      },
    },
  ]);
});

test("preview keeps all access checks and uses private inline output", async () => {
  const response = await GET(request("taskId=task%2F%22%3C17&preview=1"));
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-disposition"),
    'inline; filename="object-removed-task___17.webp"',
  );
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  const metadata = await sharp(
    new Uint8Array(await response.arrayBuffer()),
  ).metadata();
  assert.ok(metadata.width! <= 1024);
  assert.ok(metadata.height! <= 1024);
  assert.deepEqual(state.emittedEvents, []);
});

test("signed anonymous owner can download across an authenticated session", async () => {
  const token = createAnonymousPrincipal();
  state.task = {
    ...state.task!,
    userId: null,
    principalId: verifyAnonymousPrincipal(token),
  };
  const cookie = `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}`;

  state.user = null;
  assert.equal((await GET(request(undefined, cookie))).status, 200);
  state.user = { id: "newly-signed-in-user" };
  assert.equal((await GET(request(undefined, cookie))).status, 200);
});

test("anonymous output rejects missing, tampered, and another signed principal", async () => {
  const token = createAnonymousPrincipal();
  state.task = {
    ...state.task!,
    userId: null,
    principalId: verifyAnonymousPrincipal(token),
  };
  state.user = { id: "signed-in-user" };
  const otherToken = createAnonymousPrincipal();
  for (const cookie of [
    undefined,
    `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}tampered`,
    `${ANONYMOUS_PRINCIPAL_COOKIE}=${otherToken}`,
  ]) {
    const response = await GET(request(undefined, cookie));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "TASK_FORBIDDEN");
  }
  assert.deepEqual(fetchCalls, []);
});

test("expired and non-successful tasks never fetch output", async () => {
  state.task!.expiresAt = new Date(Date.now() - 1);
  const expired = await GET(request());
  assert.equal(expired.status, 410);
  assert.equal((await expired.json()).code, "TASK_EXPIRED");

  state.task!.expiresAt = new Date(Date.now() + 60_000);
  for (const taskStatus of ["queued", "processing", "failed", "expired"]) {
    state.task!.taskStatus = taskStatus;
    const response = await GET(request());
    assert.equal(response.status, 404, taskStatus);
  }
  assert.deepEqual(state.signedRequests, []);
  assert.deepEqual(fetchCalls, []);
});

test("object download refuses legacy provider and unsafe URLs until R2 migration", async () => {
  for (const outputImageUrl of [
    "https://www.runninghub.cn/results/output.png",
    "http://127.0.0.1/admin",
    "http://169.254.169.254/latest/meta-data/",
    "https://files.example.test.attacker.invalid/assets/output.png",
    "https://files.example.test/assets-elsewhere/output.png",
    "https://user:password@files.example.test/assets/output.png",
    "https://files.example.test/assets/%2Foutput.png",
    "https://files.example.test/assets/folder%2F..%2Foutput.png",
    "file:///etc/passwd",
    "malformed URL",
  ]) {
    state.task!.outputImageUrl = outputImageUrl;
    const response = await GET(request());
    assert.equal(response.status, 409, outputImageUrl);
    assert.equal((await response.json()).code, "RESULT_MIGRATION_REQUIRED");
  }
  assert.deepEqual(fetchCalls, []);
  assert.deepEqual(state.signedRequests, []);
  assert.deepEqual(state.emittedEvents, []);
});

test("object download maps missing and failed R2 reads without a download event", async () => {
  upstreamStatus = 404;
  assert.equal((await GET(request())).status, 404);
  upstreamStatus = 503;
  assert.equal((await GET(request())).status, 502);
  assert.deepEqual(state.emittedEvents, []);
});

test("download analytics failure does not block the attachment", async () => {
  state.emitError = new Error("simulated analytics failure");
  const response = await GET(request());
  assert.equal(response.status, 200);
  const metadata = await sharp(
    new Uint8Array(await response.arrayBuffer()),
  ).metadata();
  assert.ok(metadata.width! <= 1024);
  assert.equal(state.emittedEvents.length, 1);
});

test("anonymous attachment events keep the task key and authentication state", async () => {
  const token = createAnonymousPrincipal();
  state.task = {
    ...state.task!,
    userId: null,
    principalId: verifyAnonymousPrincipal(token),
  };
  state.user = null;
  const cookie = `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}`;
  assert.equal((await GET(request(undefined, cookie))).status, 200);
  assert.equal((await GET(request(undefined, cookie))).status, 200);
  assert.equal(state.emittedEvents[0]?.params.is_authenticated, false);
  assert.equal(
    state.emittedEvents[0]?.params.event_id,
    "result_downloaded:task:remove-objects:17",
  );
  assert.equal(
    state.emittedEvents[1]?.params.event_id,
    state.emittedEvents[0]?.params.event_id,
  );
});

test("download falls back to image/png when upstream omits content type", async () => {
  upstreamContentType = null;
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
});

test("inline preview rejects active content and labels supported image downloads truthfully", async () => {
  for (const contentType of [
    "text/html",
    "image/svg+xml",
    "application/javascript",
  ]) {
    upstreamContentType = contentType;
    const response = await GET(request("taskId=task-17&preview=1"));
    assert.equal(response.status, 502, contentType);
  }
  assert.deepEqual(state.emittedEvents, []);

  upstreamContentType = "image/jpeg";
  const jpeg = await GET(request());
  assert.equal(jpeg.status, 200);
  assert.equal(
    jpeg.headers.get("content-disposition"),
    'attachment; filename="object-removed-task-17.jpg"',
  );
});

test("oversized object output fails before download analytics and body buffering", async () => {
  let canceled = false;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        cancel: () => {
          canceled = true;
        },
      }),
      {
        headers: {
          "content-type": "image/png",
          "content-length": String(11 * 1024 * 1024),
        },
      },
    );
  const response = await GET(request());
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "RESULT_TOO_LARGE");
  assert.equal(canceled, true);
  assert.deepEqual(state.emittedEvents, []);
});

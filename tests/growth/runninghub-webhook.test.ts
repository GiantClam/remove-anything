import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { env, resetRunninghubWebhookState, runninghubWebhookState as state } from "../support/runninghub-webhook-stubs";

const routePromise = import("../../app/api/webhooks/runninghub/route");
const outputPromise = import("../../lib/runninghub-output");
const originalFetch = globalThis.fetch;
const source = "https://provider.example.test/outputs/result.png?signature=private-provider-token";
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);

beforeEach(() => {
  resetRunninghubWebhookState();
  globalThis.fetch = async () => { throw new Error("Unexpected network access"); };
});
afterEach(() => { globalThis.fetch = originalFetch; });

function request(options: { code?: number; url?: string; key?: string | null; header?: boolean; body?: string; data?: unknown } = {}) {
  const key = options.key === undefined ? env.RUNNINGHUB_WEBHOOK_SECRET : options.key;
  const url = new URL("https://remove-anything.test/api/webhooks/runninghub");
  const headers = new Headers({ "content-type": "application/json" });
  if (key) options.header ? headers.set("remove-anything-webhook-key", key) : url.searchParams.set("key", key);
  return new Request(url, { method: "POST", headers, body: options.body ?? JSON.stringify({
    event: "TASK_END", taskId: "provider-23", eventData: JSON.stringify({ code: options.code ?? 0, data: options.data ?? [{ fileUrl: options.url ?? source }] }),
  }) });
}
async function callback(options: Parameters<typeof request>[0] = {}) { return (await routePromise).POST(request(options)); }
function imageResponse() { return new Response(png, { headers: { "content-type": "image/png" } }); }

test("missing or invalid callback credentials are rejected before body, database, or output access", async () => {
  for (const key of [null, "incorrect-secret"]) {
    assert.equal((await callback({ key, body: "invalid json" })).status, 401);
  }
  env.RUNNINGHUB_WEBHOOK_SECRET = "";
  assert.equal((await callback({ key: "anything" })).status, 503);
  env.RUNNINGHUB_WEBHOOK_SECRET = "short-key";
  assert.equal((await callback()).status, 503);
  assert.equal(state.reads, 0);
  assert.equal(state.casAttempts, 0);
  assert.deepEqual(state.uploads, []);
});

test("authenticated header failure callback records a canonical failure without fetching output", async () => {
  assert.equal((await callback({ code: 503, header: true })).status, 200);
  assert.equal(state.object!.taskStatus, "failed");
  assert.equal(state.transitions, 1);
  assert.deepEqual(state.stopped, ["provider-23"]);
  assert.deepEqual(state.uploads, []);
});

test("malformed and oversized authenticated bodies are bounded before task lookup", async () => {
  assert.equal((await callback({ body: "invalid json" })).status, 400);
  assert.equal((await callback({ body: " ".repeat(65 * 1024) })).status, 413);
  assert.equal(state.reads, 0);
  assert.equal(state.casAttempts, 0);
});

test("object callback fetches only its approved source with timeout, no redirects and a private persisted result", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, source);
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal);
    return imageResponse();
  };
  const response = await callback();
  assert.equal(response.status, 200);
  assert.equal(state.object!.taskStatus, "succeeded");
  assert.match(state.object!.outputImageUrl!, /^https:\/\/r2\.example\.test\/assets\/object-removal\/processed\/23-callback-[a-f0-9]{64}\.png$/);
  assert.equal(state.uploads.length, 1);
  assert.equal(state.uploads[0].options.acl, "private");
  assert.equal(state.uploads[0].options.ContentType, "image/png");
  assert.deepEqual(state.uploads[0].bytes, Buffer.from(png));
  const body = await response.text();
  assert.ok(!body.includes("https://"));
  assert.ok(!body.includes(env.RUNNINGHUB_WEBHOOK_SECRET));
});

test("watermark callback wraps a supported image into a bounded private ZIP", async () => {
  resetRunninghubWebhookState("watermark");
  globalThis.fetch = async () => imageResponse();
  assert.equal((await callback()).status, 200);
  assert.equal(state.watermark!.taskStatus, "succeeded");
  assert.match(state.watermark!.outputZipUrl!, /watermark-removal\/processed\/23-callback-[a-f0-9]{64}\.zip$/);
  assert.equal(state.uploads[0].options.ContentType, "application/zip");
  assert.equal(state.uploads[0].options.acl, "private");
  assert.equal(state.uploads[0].bytes.subarray(0, 2).toString(), "PK");
});

test("duplicate completed callbacks do not repeat migration or overwrite a terminal result", async () => {
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; return imageResponse(); };
  assert.equal((await callback()).status, 200);
  const firstOutput = state.object!.outputImageUrl;
  assert.equal((await callback()).status, 200);
  assert.equal((await callback({ code: 503 })).status, 200);
  assert.equal(fetches, 1);
  assert.equal(state.transitions, 1);
  assert.equal(state.object!.outputImageUrl, firstOutput);
  assert.equal(state.object!.taskStatus, "succeeded");
});

test("concurrent callback deliveries share an exact content key and only one state transition", async () => {
  globalThis.fetch = async () => imageResponse();
  const responses = await Promise.all([callback(), callback()]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(state.casAttempts, 2);
  assert.equal(state.transitions, 1);
  assert.equal(state.stopped.length, 1);
  assert.equal(new Set(state.uploads.map((upload) => upload.filename)).size, 1);
});

test("a slow successful callback cannot overwrite a concurrent terminal failure", async () => {
  globalThis.fetch = async () => {
    state.object!.taskStatus = "failed";
    state.object!.errorMsg = "A newer provider failure";
    return imageResponse();
  };
  assert.equal((await callback()).status, 200);
  assert.equal(state.object!.taskStatus, "failed");
  assert.equal(state.object!.errorMsg, "A newer provider failure");
  assert.equal(state.object!.outputImageUrl, null);
  assert.equal(state.transitions, 0);
  assert.deepEqual(state.stopped, []);
});

test("an output repair with unchanged status also defeats the stale callback CAS", async () => {
  globalThis.fetch = async () => {
    state.object!.outputImageUrl = "https://r2.example.test/assets/newer-result.png";
    return imageResponse();
  };
  assert.equal((await callback()).status, 200);
  assert.equal(state.object!.outputImageUrl, "https://r2.example.test/assets/newer-result.png");
  assert.equal(state.transitions, 0);
});

test("terminal or expired records do not fetch results or mutate", async () => {
  for (const status of ["succeeded", "failed", "expired", "CANCELED"]) {
    resetRunninghubWebhookState();
    state.object!.taskStatus = status;
    assert.equal((await callback()).status, 200);
    assert.equal(state.casAttempts, 0);
  }
  resetRunninghubWebhookState();
  state.object!.expiresAt = new Date(Date.now() - 1);
  assert.equal((await callback()).status, 200);
  assert.equal(state.casAttempts, 0);
  state.object!.expiresAt = null;
  state.object!.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
  assert.equal((await callback()).status, 200);
  assert.equal(state.casAttempts, 0);
});

test("unapproved sources, lookalike origins, traversal, credentials and private addresses cannot trigger fetches", async () => {
  const { isAllowedRunningHubOutput } = await outputPromise;
  for (const url of [
    "https://provider.example.test.evil.test/outputs/a.png",
    "https://provider.example.test/outputs-evil/a.png",
    "https://provider.example.test/outputs/%2e%2e/private.png",
    "https://provider.example.test/outputs/%252e%252e/private.png",
    "https://user:password@provider.example.test/outputs/a.png",
    "http://provider.example.test/outputs/a.png",
    "https://localhost/outputs/a.png",
    "https://127.0.0.1/outputs/a.png",
    "https://169.254.169.254/outputs/a.png",
    "https://[::1]/outputs/a.png",
  ]) {
    assert.equal((await callback({ url })).status, 503, url);
  }
  for (const origin of ["https://localhost", "https://127.0.0.1", "https://169.254.169.254", "https://[::1]"]) {
    assert.equal(isAllowedRunningHubOutput(`${origin}/outputs/a.png`, `${origin}/outputs/`), false);
  }
  assert.equal(state.casAttempts, 0);
  assert.deepEqual(state.uploads, []);
});

test("missing provider allowlist and missing output preserve polling recovery", async () => {
  env.RUNNINGHUB_OUTPUT_URL_PREFIXES = "";
  assert.equal((await callback()).status, 503);
  assert.equal((await callback({ data: [] })).status, 503);
  assert.equal(state.object!.taskStatus, "processing");
  assert.equal(state.transitions, 0);
});

test("redirect and invalid output bytes do not mark a result succeeded", async () => {
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  assert.equal((await callback()).status, 503);
  globalThis.fetch = async () => new Response("<html>not an image</html>", { headers: { "content-type": "image/png" } });
  assert.equal((await callback()).status, 503);
  assert.equal(state.object!.taskStatus, "processing");
  assert.deepEqual(state.uploads, []);
});

test("transfer failures keep polling available and never log bearer or signed output URLs", async () => {
  const originalWarn = console.warn;
  const logged: string[] = [];
  console.warn = (...values: unknown[]) => { logged.push(values.join(" ")); };
  try {
    globalThis.fetch = async () => { throw new Error(`${env.RUNNINGHUB_WEBHOOK_SECRET} ${source}`); };
    const response = await callback();
    assert.equal(response.status, 503);
    const text = `${logged.join("\n")} ${await response.text()}`;
    assert.ok(!text.includes(env.RUNNINGHUB_WEBHOOK_SECRET));
    assert.ok(!text.includes(source));
    assert.equal(state.object!.taskStatus, "processing");
    assert.equal(state.transitions, 0);
  } finally {
    console.warn = originalWarn;
  }
});

test("oversized streamed output is canceled without a write even when content length is absent", async () => {
  let canceled = false;
  globalThis.fetch = async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { canceled = true; },
  }), { headers: { "content-type": "image/png" } });
  assert.equal((await callback()).status, 413);
  assert.equal(canceled, true);
  assert.equal(state.transitions, 0);
  assert.deepEqual(state.uploads, []);
});

test("the disabled legacy video path keeps metadata-only behavior behind authentication and CAS", async () => {
  resetRunninghubWebhookState("video");
  assert.equal((await callback()).status, 200);
  assert.equal(state.video!.taskStatus, "succeeded");
  assert.equal(state.video!.imageUrl, source);
  assert.deepEqual(state.uploads, []);
});

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test, { afterEach, beforeEach } from "node:test";

import {
  env,
  replicateWebhookState as state,
  resetReplicateWebhookState,
} from "../support/replicate-webhook-stubs";

const routePromise = import("../../app/api/webhooks/replicate/route");
const originalFetch = globalThis.fetch;
const source = "https://replicate.delivery/pbxt/result.png?token=private";
const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0,
]);

beforeEach(() => {
  resetReplicateWebhookState();
  globalThis.fetch = async () => {
    throw new Error("Unexpected network access");
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function signedRequest(
  rawBody: string,
  options: { timestamp?: number; secret?: string | null; signatureBody?: string } = {},
) {
  const id = "webhook-message-1";
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const secret = options.secret === undefined ? env.REPLICATE_WEBHOOK_SECRET : options.secret;
  const key = secret?.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret || "");
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${options.signatureBody ?? rawBody}`)
    .digest("base64");
  return new Request("https://remove-anything.test/api/webhooks/replicate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    },
    body: rawBody,
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: "prediction-17",
    status: "succeeded",
    output: source,
    logs: "done",
    ...overrides,
  });
}

async function callback(request: Request) {
  return (await routePromise).POST(request);
}

test("missing or invalid signatures and missing secrets are rejected before task lookup", async () => {
  const raw = "not json";
  const valid = signedRequest(raw);
  const absent = new Request(valid.url, { method: "POST", body: raw });
  assert.equal((await callback(absent)).status, 401);
  assert.equal((await callback(signedRequest(raw, { signatureBody: "different" }))).status, 401);
  assert.equal((await callback(signedRequest(raw, { timestamp: Math.floor(Date.now() / 1000) - 600 }))).status, 401);
  assert.equal(state.reads, 0);

  env.REPLICATE_WEBHOOK_SECRET = "";
  assert.equal((await callback(signedRequest(raw, { secret: "" }))).status, 503);
  env.REPLICATE_WEBHOOK_SECRET = "not-a-standard-webhooks-secret-with-32-bytes";
  assert.equal((await callback(signedRequest(raw, { secret: env.REPLICATE_WEBHOOK_SECRET }))).status, 401);
  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
});

test("signature authenticates exact raw bytes before JSON parsing or task lookup", async () => {
  assert.equal((await callback(signedRequest("{ invalid"))).status, 400);
  const raw = payload();
  const mutated = `${raw} `;
  assert.equal((await callback(signedRequest(mutated, { signatureBody: raw }))).status, 401);
  assert.equal(state.reads, 0);
});

test("successful callback migrates one approved image to private R2 before recording success", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, source);
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal);
    return new Response(png, { headers: { "content-type": "image/png" } });
  };
  const response = await callback(signedRequest(payload()));
  assert.equal(response.status, 200);
  assert.equal(state.task.taskStatus, "succeeded");
  assert.match(state.task.outputImageUrl!, /^https:\/\/r2\.example\.test\/assets\/background-removal\/processed\/17-callback-[a-f0-9]{64}\.png$/);
  assert.equal(state.uploads.length, 1);
  assert.equal(state.uploads[0].options.acl, "private");
  assert.equal(state.uploads[0].options.ContentType, "image/png");
  assert.deepEqual(state.uploads[0].bytes, Buffer.from(png));
  assert.equal(state.writes, 1);
});

test("provider URLs outside explicit HTTPS prefixes and ambiguous output arrays are rejected", async () => {
  for (const output of [
    "http://replicate.delivery/pbxt/a.png",
    "https://replicate.delivery.evil.test/pbxt/a.png",
    "https://replicate.delivery/pbxt/../private.png",
    "https://localhost/pbxt/a.png",
    "https://127.0.0.1/pbxt/a.png",
    [source, source],
  ]) {
    assert.equal((await callback(signedRequest(payload({ output })))).status, 503);
  }
  assert.equal(state.writes, 0);
  assert.deepEqual(state.uploads, []);

  env.REPLICATE_OUTPUT_URL_PREFIXES = "";
  assert.equal((await callback(signedRequest(payload()))).status, 503);
  assert.equal(state.writes, 0);
});

test("invalid bytes are rejected even when provider labels them as an image", async () => {
  globalThis.fetch = async () =>
    new Response("<html>not an image</html>", {
      headers: { "content-type": "image/png" },
    });
  assert.equal((await callback(signedRequest(payload()))).status, 503);
  assert.equal(state.task.taskStatus, "processing");
  assert.equal(state.writes, 0);
  assert.deepEqual(state.uploads, []);
});

test("R2 or task migration failures never persist the provider URL or report success", async () => {
  globalThis.fetch = async () => new Response(png);
  state.failPut = true;
  assert.equal((await callback(signedRequest(payload()))).status, 503);
  assert.equal(state.task.taskStatus, "processing");
  assert.equal(state.task.outputImageUrl, null);
  assert.equal(state.writes, 0);

  state.failPut = false;
  state.failUpdate = true;
  assert.equal((await callback(signedRequest(payload()))).status, 503);
  assert.equal(state.task.taskStatus, "processing");
  assert.equal(state.task.outputImageUrl, null);
  assert.equal(state.writes, 0);
  assert.equal(state.uploads.length, 1);
  assert.ok(!JSON.stringify(state.task).includes(source));
});

test("remote result size is capped before object storage", async () => {
  globalThis.fetch = async () =>
    new Response(null, {
      status: 200,
      headers: { "content-length": String(10 * 1024 * 1024 + 1) },
    });
  const response = await callback(signedRequest(payload()));
  assert.equal(response.status, 413);
  assert.equal(state.writes, 0);
  assert.deepEqual(state.uploads, []);
});

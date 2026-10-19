import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import JSZip from "jszip";

import {
  ANONYMOUS_PRINCIPAL_COOKIE,
  createAnonymousPrincipal,
  verifyAnonymousPrincipal,
} from "../../lib/task-lifecycle";
import { legacyDownloadState as state } from "../support/legacy-download-stubs";

const routes = Promise.all([
  import("../../app/api/download-background/route"),
  import("../../app/api/download/route"),
]);
process.env.ANONYMOUS_PRINCIPAL_SECRET = "legacy-download-test-secret";
const originalFetch = globalThis.fetch;
let calls: RequestInit[] = [];
let fetchedUrls: string[] = [];
let output = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
let contentType = "image/png";
let declaredLength: string | undefined;

beforeEach(() => {
  state.user = { id: "owner" };
  state.downloaded = 0;
  state.signedKeys = [];
  state.task = {
    id: 17,
    userId: "owner",
    principalId: null,
    taskStatus: "succeeded",
    outputImageUrl: "https://files.test/bucket/processed/result.png",
    outputZipUrl: "https://files.test/bucket/processed/result.png",
    expiresAt: new Date(Date.now() + 60_000),
  };
  calls = [];
  fetchedUrls = [];
  output = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  contentType = "image/png";
  declaredLength = undefined;
  globalThis.fetch = async (_url, options) => {
    fetchedUrls.push(String(_url));
    calls.push(options || {});
    return new Response(output, {
      headers: {
        "content-type": contentType,
        ...(declaredLength ? { "content-length": declaredLength } : {}),
      },
    });
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function request(watermark: boolean, token?: string) {
  return new NextRequest(
    `https://remove-anything.test/api/${watermark ? "download?type=watermark-removal&" : "download-background?"}taskId=task-17`,
    {
      headers: token
        ? { cookie: `${ANONYMOUS_PRINCIPAL_COOKIE}=${token}` }
        : {},
    },
  );
}

test("legacy image and ZIP download routes reject strangers, unfinished work, and expired results before fetch", async () => {
  const [background, watermark] = await routes;
  for (const [index, route] of [background, watermark].entries()) {
    for (const change of [
      { userId: "stranger" },
      { taskStatus: "processing" },
      { expiresAt: new Date(0) },
    ]) {
      const previous = { ...state.task };
      Object.assign(state.task, change);
      const response = await route.GET(request(index === 1));
      assert.ok([403, 404, 410].includes(response.status));
      assert.equal(calls.length, 0);
      state.task = previous;
    }
  }
});

test("a signed anonymous task remains downloadable after signing in, with private no-store output", async () => {
  const [background, watermark] = await routes;
  const token = createAnonymousPrincipal();
  state.task.userId = null;
  state.task.principalId = verifyAnonymousPrincipal(token);
  for (const [index, route] of [background, watermark].entries()) {
    const response = await route.GET(request(index === 1, token));
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("cache-control"),
      "private, no-store, max-age=0",
    );
    assert.equal(response.headers.get("vary"), "Cookie, Authorization");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    if (index === 1) {
      const zip = await JSZip.loadAsync(await response.arrayBuffer());
      assert.ok(zip.file("image_1.png"));
    }
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0].redirect, "error");
  assert.equal(calls[0].cache, "no-store");
});

test("active content and oversized legacy results fail without a download counter", async () => {
  const [background, watermark] = await routes;
  for (const [index, route] of [background, watermark].entries()) {
    contentType = "text/html";
    assert.equal((await route.GET(request(index === 1))).status, 502);
    contentType = "image/png";
    declaredLength = String(11 * 1024 * 1024);
    const oversized = await route.GET(request(index === 1));
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).code, "RESULT_TOO_LARGE");
    assert.equal(state.downloaded, 0);
    declaredLength = undefined;
  }
});

test("watermark returns a ZIP attachment when the provider already supplies a ZIP", async () => {
  const [, watermark] = await routes;
  const zip = new JSZip();
  zip.file("result.png", output);
  output = await zip.generateAsync({ type: "uint8array" });
  contentType = "application/zip";
  const response = await watermark.GET(request(true));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/zip");
  assert.match(
    response.headers.get("content-disposition") || "",
    /attachment;.*\.zip/,
  );
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), output);
});

test("watermark rejects a mislabeled ZIP instead of wrapping arbitrary bytes", async () => {
  const [, watermark] = await routes;
  contentType = "application/zip";
  for (const bytes of [
    new Uint8Array([0x50, 0x4b]),
    new TextEncoder().encode("<html>not a zip</html>"),
  ]) {
    output = bytes;
    const response = await watermark.GET(request(true));
    assert.equal(response.status, 502);
    assert.equal(state.downloaded, 0);
  }
});

test("background preview keeps download authorization and does not count as a download", async () => {
  const [background] = await routes;
  const previewRequest = () =>
    new NextRequest(
      "https://remove-anything.test/api/download-background?taskId=task-17&preview=1",
    );
  let response = await background.GET(previewRequest());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition") || "", /^inline;/);
  assert.equal(state.downloaded, 0);
  state.task.userId = "stranger";
  response = await background.GET(previewRequest());
  assert.equal(response.status, 403);
  assert.equal(calls.length, 1);
  state.task.userId = "owner";
  state.task.expiresAt = new Date(0);
  response = await background.GET(previewRequest());
  assert.equal(response.status, 410);
  assert.equal(calls.length, 1);
  assert.equal(state.downloaded, 0);
});

test("private R2 results are fetched with short-lived signed URLs after authorization", async () => {
  const [background, watermark] = await routes;
  state.task.outputImageUrl = "https://files.test/bucket/processed/result.png";
  state.task.outputZipUrl = "https://files.test/bucket/processed/result.png";
  for (const [index, route] of [background, watermark].entries()) {
    const response = await route.GET(request(index === 1));
    assert.equal(response.status, 200);
  }
  assert.deepEqual(
    state.signedKeys,
    Array(2).fill({
      key: "processed/result.png",
      bucket: "private-test-bucket",
      expires: 60,
    }),
  );
  assert.deepEqual(
    fetchedUrls,
    Array(2).fill("https://signed-files.test/processed/result.png"),
  );
  state.task.userId = "stranger";
  assert.equal((await watermark.GET(request(true))).status, 403);
  assert.equal(state.signedKeys.length, 2);
});

test("raw provider outputs cannot bypass secure result migration", async () => {
  const [background, watermark] = await routes;
  state.task.outputImageUrl = "https://provider.test/output.png";
  state.task.outputZipUrl = "https://provider.test/result.zip";
  for (const [index, route] of [background, watermark].entries()) {
    const response = await route.GET(request(index === 1));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "RESULT_MIGRATION_REQUIRED");
  }
  assert.equal(calls.length, 0);
  assert.equal(state.signedKeys.length, 0);
  assert.equal(state.downloaded, 0);
});

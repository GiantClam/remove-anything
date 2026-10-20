import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import JSZip from "jszip";
import sharp from "sharp";

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
let output = new Uint8Array();
let contentType = "image/png";
let declaredLength: string | undefined;

beforeEach(async () => {
  state.user = { id: "owner" };
  state.downloaded = 0;
  state.signedKeys = [];
  state.emittedEvents = [];
  state.analyticsAttempts = 0;
  state.analyticsError = null;
  state.taskData = null;
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
  output = new Uint8Array(
    await sharp({
      create: {
        width: 2048,
        height: 1200,
        channels: 4,
        background: { r: 20, g: 140, b: 220, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer(),
  );
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

function genericRequest(query: string) {
  return new NextRequest(`https://remove-anything.test/api/download?${query}`);
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
      const metadata = await sharp(
        await zip.file("image_1.png")!.async("uint8array"),
      ).metadata();
      assert.ok(metadata.width! <= 1024);
      assert.ok(metadata.height! <= 1024);
    } else {
      const metadata = await sharp(
        new Uint8Array(await response.arrayBuffer()),
      ).metadata();
      assert.ok(metadata.width! <= 1024);
      assert.ok(metadata.height! <= 1024);
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
    assert.equal(state.analyticsAttempts, 0);
    assert.equal(state.emittedEvents.length, 0);
    declaredLength = undefined;
  }
});

test("watermark returns a rebuilt ZIP with resized image members", async () => {
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
  const rebuilt = await JSZip.loadAsync(await response.arrayBuffer());
  const metadata = await sharp(
    await rebuilt.file("result.png")!.async("uint8array"),
  ).metadata();
  assert.ok(metadata.width! <= 1024);
  assert.ok(metadata.height! <= 1024);
  assert.equal(state.analyticsAttempts, 1);
  assert.equal(state.emittedEvents.length, 1);
  assert.equal(state.emittedEvents[0]?.name, "result_downloaded");
  assert.equal(state.emittedEvents[0]?.params.tool_slug, "remove-watermark");
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
    assert.equal(state.analyticsAttempts, 0);
    assert.equal(state.emittedEvents.length, 0);
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
  const metadata = await sharp(
    new Uint8Array(await response.arrayBuffer()),
  ).metadata();
  assert.ok(metadata.width! <= 1024);
  assert.equal(state.downloaded, 0);
  assert.equal(state.analyticsAttempts, 0);
  assert.equal(state.emittedEvents.length, 0);
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
  assert.equal(state.analyticsAttempts, 0);
  assert.equal(state.emittedEvents.length, 0);
});

test("background downloads emit exactly one result_downloaded event", async () => {
  const [background] = await routes;
  const response = await background.GET(request(false));
  assert.equal(response.status, 200);
  assert.equal(state.downloaded, 1);
  assert.equal(state.analyticsAttempts, 1);
  assert.equal(state.emittedEvents.length, 1);
  assert.equal(state.emittedEvents[0]?.name, "result_downloaded");
  assert.equal(state.emittedEvents[0]?.params.tool_slug, "remove-background");
});

test("analytics sink failures do not fail an authorized download", async () => {
  const [background] = await routes;
  state.analyticsError = new Error("analytics unavailable");
  const response = await background.GET(request(false));
  assert.equal(response.status, 200);
  assert.equal(state.downloaded, 1);
  assert.equal(state.analyticsAttempts, 1);
  assert.equal(state.emittedEvents.length, 0);
});

test("download route analytics sink failures do not fail authorized attachments", async () => {
  const [, download] = await routes;
  state.analyticsError = new Error("analytics unavailable");
  const pngOutput = output;
  const watermarkZip = new JSZip();
  watermarkZip.file("result.png", output);
  output = await watermarkZip.generateAsync({ type: "uint8array" });
  contentType = "application/zip";
  const watermarkResponse = await download.GET(
    genericRequest("type=watermark-removal&taskId=task-17"),
  );
  assert.equal(watermarkResponse.status, 200);

  output = pngOutput;
  state.taskData = {
    id: 17,
    userId: "owner",
    principalId: null,
    taskStatus: "succeeded",
    imageUrl: "https://files.test/bucket/processed/legacy-result.png",
    expiresAt: new Date(Date.now() + 60_000),
  };
  contentType = "image/png";
  const legacyResponse = await download.GET(genericRequest("taskId=task-17"));
  assert.equal(legacyResponse.status, 200);
  assert.equal(state.analyticsAttempts, 2);
  assert.equal(state.emittedEvents.length, 0);
});

test("all supported preview routes omit result_downloaded events", async () => {
  const [background, download] = await routes;
  const pngOutput = output;
  const watermarkZip = new JSZip();
  watermarkZip.file("result.png", output);
  output = await watermarkZip.generateAsync({ type: "uint8array" });
  contentType = "application/zip";
  let response = await download.GET(
    genericRequest("type=watermark-removal&taskId=task-17&preview=1"),
  );
  assert.equal(response.status, 200);

  output = pngOutput;
  state.taskData = {
    id: 17,
    userId: "owner",
    principalId: null,
    taskStatus: "succeeded",
    imageUrl: "https://files.test/bucket/processed/legacy-result.png",
    expiresAt: new Date(Date.now() + 60_000),
  };
  contentType = "image/png";
  response = await download.GET(genericRequest("taskId=task-17&preview=1"));
  assert.equal(response.status, 200);

  state.taskData = {
    id: 17,
    userId: "owner",
    principalId: null,
    taskStatus: "succeeded",
    model: "sora2-video-watermark-removal",
    replicateId: "task-17",
    imageUrl: "https://files.test/bucket/processed/video.mp4",
    expiresAt: new Date(Date.now() + 60_000),
  };
  contentType = "video/mp4";
  output = new TextEncoder().encode("\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2");
  response = await download.GET(
    genericRequest(
      "type=sora2-video-watermark-removal&taskId=task-17&preview=1",
    ),
  );
  assert.equal(response.status, 200);

  output = pngOutput;
  contentType = "image/png";
  response = await background.GET(
    new NextRequest(
      "https://remove-anything.test/api/download-background?taskId=task-17&preview=1",
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(state.analyticsAttempts, 0);
  assert.equal(state.emittedEvents.length, 0);
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

test("historical TaskData image downloads use private R2 and the low-resolution boundary", async () => {
  const [, download] = await routes;
  state.taskData = {
    id: 17,
    userId: "owner",
    principalId: null,
    taskStatus: "succeeded",
    imageUrl: "https://files.test/bucket/processed/legacy-result.png",
    expiresAt: new Date(Date.now() + 60_000),
  };
  const response = await download.GET(genericRequest("taskId=task-17"));
  assert.equal(response.status, 200);
  assert.deepEqual(state.signedKeys, [
    {
      key: "processed/legacy-result.png",
      bucket: "private-test-bucket",
      expires: 60,
    },
  ]);
  assert.equal(
    fetchedUrls[0],
    "https://signed-files.test/processed/legacy-result.png",
  );
  assert.equal(calls[0]?.redirect, "error");
  assert.equal(calls[0]?.cache, "no-store");
  assert.equal(response.headers.get("x-output-max-edge-px"), "1024");
  const metadata = await sharp(
    new Uint8Array(await response.arrayBuffer()),
  ).metadata();
  assert.ok(metadata.width! <= 1024);
  assert.ok(metadata.height! <= 1024);
  assert.equal(state.analyticsAttempts, 1);
  assert.equal(state.emittedEvents.length, 1);
  assert.equal(state.emittedEvents[0]?.name, "result_downloaded");
  assert.equal(state.emittedEvents[0]?.params.tool_slug, "remove-background");

  contentType = "text/html";
  const failed = await download.GET(genericRequest("taskId=task-17"));
  assert.equal(failed.status, 502);
  assert.equal(state.analyticsAttempts, 1);
  assert.equal(state.emittedEvents.length, 1);
});

test("historical TaskData and Sora2 provider URLs fail closed before any fetch", async () => {
  const [, download] = await routes;
  for (const [query, model] of [
    ["taskId=task-17", "legacy-image"],
    [
      "type=sora2-video-watermark-removal&taskId=task-17",
      "sora2-video-watermark-removal",
    ],
  ] as const) {
    state.taskData = {
      id: 17,
      userId: "owner",
      principalId: null,
      taskStatus: "succeeded",
      model,
      replicateId: "task-17",
      imageUrl: "https://provider.test/outputs/result.mp4",
      expiresAt: new Date(Date.now() + 60_000),
    };
    const response = await download.GET(genericRequest(query));
    assert.equal(response.status, 409, query);
    assert.equal((await response.json()).code, "RESULT_MIGRATION_REQUIRED");
  }
  assert.deepEqual(fetchedUrls, []);
  assert.deepEqual(state.signedKeys, []);
});

test("Sora2 downloads require private R2, approved video MIME, and bounded reads", async () => {
  const [, download] = await routes;
  state.taskData = {
    id: 17,
    userId: "owner",
    principalId: null,
    taskStatus: "succeeded",
    model: "sora2-video-watermark-removal",
    replicateId: "task-17",
    imageUrl: "https://files.test/bucket/processed/video.mp4",
    expiresAt: new Date(Date.now() + 60_000),
  };
  contentType = "video/mp4";
  output = new TextEncoder().encode(
    "\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2",
  );
  const response = await download.GET(
    genericRequest("type=sora2-video-watermark-removal&taskId=task-17"),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.match(
    response.headers.get("content-disposition") || "",
    /sora2-video-watermark-removed-task-17\.mp4/,
  );
  assert.equal(state.signedKeys[0]?.key, "processed/video.mp4");
  assert.equal(state.analyticsAttempts, 1);
  assert.equal(state.emittedEvents.length, 1);
  assert.equal(state.emittedEvents[0]?.name, "result_downloaded");
  assert.equal(
    state.emittedEvents[0]?.params.tool_slug,
    "sora2-video-watermark-removal",
  );

  contentType = "text/html";
  assert.equal(
    (
      await download.GET(
        genericRequest("type=sora2-video-watermark-removal&taskId=task-17"),
      )
    ).status,
    502,
  );
  contentType = "video/mp4";
  declaredLength = String(501 * 1024 * 1024);
  const oversized = await download.GET(
    genericRequest("type=sora2-video-watermark-removal&taskId=task-17"),
  );
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).code, "RESULT_TOO_LARGE");
  assert.equal(state.analyticsAttempts, 1);
  assert.equal(state.emittedEvents.length, 1);
});

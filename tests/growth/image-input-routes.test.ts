import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import { TINY_PNG_BYTES } from "../support/image-fixtures";
import { imageInputRouteState } from "../support/image-input-route-stubs";

const uploadRoute = import("../../app/api/upload/route");
const assetsRoute = import("../../app/api/remove-objects/assets/route");
const originalFetch = globalThis.fetch;
const originalR2Base = process.env.R2_URL_BASE;
beforeEach(() => {
  process.env.R2_URL_BASE = "https://files.example.test";
  imageInputRouteState.uploads.length = 0;
  globalThis.fetch = async () =>
    new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
});
after(() => {
  globalThis.fetch = originalFetch;
  if (originalR2Base === undefined) delete process.env.R2_URL_BASE;
  else process.env.R2_URL_BASE = originalR2Base;
});
function urlRequest(imageUrl: unknown) {
  return new NextRequest("https://app.example.test/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  });
}
function fileRequest(file: File) {
  const data = new FormData();
  data.set("file", file);
  return new NextRequest("https://app.example.test/api/remove-objects/assets", {
    method: "POST",
    body: data,
  });
}

test("upload route rejects arbitrary URLs before network/storage and accepts a decoded trusted image", async () => {
  const { POST } = await uploadRoute;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls++;
    return new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
  };
  const denied = await POST(
    urlRequest("https://untrusted.example.test/image.png"),
  );
  assert.equal(denied.status, 400);
  assert.equal((await denied.json()).code, "UNTRUSTED_IMAGE_URL");
  assert.equal(fetchCalls, 0);
  assert.equal(imageInputRouteState.uploads.length, 0);
  assert.equal(
    (await POST(urlRequest("https://files.example.test/input.png"))).status,
    200,
  );
  assert.equal(fetchCalls, 1);
  assert.equal(imageInputRouteState.uploads[0].type, "image/png");
});

test("assets route validates actual bytes, MIME, and 10MB before storing", async () => {
  const { POST } = await assetsRoute;
  for (const file of [
    new File([new Uint8Array([1, 2, 3])], "spoof.png", { type: "image/png" }),
    new File([new Uint8Array(TINY_PNG_BYTES)], "spoof.jpg", {
      type: "image/jpeg",
    }),
  ]) {
    const response = await POST(fileRequest(file));
    assert.equal(response.status, 415);
    assert.equal((await response.json()).code, "UNSUPPORTED_IMAGE_FORMAT");
  }
  assert.equal(
    (
      await POST(
        fileRequest(
          new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", {
            type: "image/png",
          }),
        ),
      )
    ).status,
    413,
  );
  assert.equal(imageInputRouteState.uploads.length, 0);
  assert.equal(
    (
      await POST(
        fileRequest(
          new File([new Uint8Array(TINY_PNG_BYTES)], "image.png", {
            type: "image/png",
          }),
        ),
      )
    ).status,
    200,
  );
  assert.equal(imageInputRouteState.uploads.length, 1);
});

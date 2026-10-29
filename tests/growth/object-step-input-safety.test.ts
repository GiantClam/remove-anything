import { NextRequest } from "next/server.js";

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import { TINY_PNG_BYTES } from "../support/image-fixtures";
import { objectGeometryRouteState } from "../support/object-geometry-route-stubs";

const detectRoute = import("../../app/api/remove-objects/detect/route");
const segmentRoute = import("../../app/api/remove-objects/segment/route");
const originalFetch = globalThis.fetch;
const originalAllowedOrigins = process.env.IMAGE_INPUT_ALLOWED_ORIGINS;

beforeEach(() => {
  objectGeometryRouteState.reset();
  process.env.IMAGE_INPUT_ALLOWED_ORIGINS = "https://assets.example.test";
  globalThis.fetch = async () =>
    new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
});

after(() => {
  globalThis.fetch = originalFetch;
  if (originalAllowedOrigins === undefined)
    delete process.env.IMAGE_INPUT_ALLOWED_ORIGINS;
  else process.env.IMAGE_INPUT_ALLOWED_ORIGINS = originalAllowedOrigins;
});

function request(path: string, body: unknown) {
  return new NextRequest(`https://app.example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("detect rejects untrusted URLs before provider creation", async () => {
  const { POST } = await detectRoute;
  const response = await POST(
    request("/api/remove-objects/detect", {
      imageUrl: "https://evil.example.test/x.png",
      prompt: "person",
    }),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "UNTRUSTED_IMAGE_URL");
  assert.equal(objectGeometryRouteState.createCalls, 0);
});

test("segment validates decoded input and bounding box before provider creation", async () => {
  const { POST } = await segmentRoute;
  const outOfBounds = await POST(
    request("/api/remove-objects/segment", {
      imageUrl: "https://assets.example.test/x.png",
      bbox: { x: 0, y: 0, w: 2, h: 1 },
    }),
  );
  assert.equal(outOfBounds.status, 400);
  assert.equal((await outOfBounds.json()).code, "BBOX_OUT_OF_BOUNDS");
  assert.equal(objectGeometryRouteState.createCalls, 0);
});

test("detect and segment pass trusted decoded images to provider flow", async () => {
  const detect = await detectRoute;
  const segment = await segmentRoute;
  const detectResponse = await detect.POST(
    request("/api/remove-objects/detect", {
      imageUrl: "https://assets.example.test/x.png",
      prompt: "person",
    }),
  );
  assert.equal(detectResponse.status, 200);
  assert.equal((await detectResponse.json()).success, true);
  const segmentResponse = await segment.POST(
    request("/api/remove-objects/segment", {
      imageUrl: "https://assets.example.test/x.png",
      bbox: { x: 0, y: 0, w: 1, h: 1 },
    }),
  );
  assert.equal(segmentResponse.status, 200);
  assert.equal((await segmentResponse.json()).success, true);
  assert.equal(objectGeometryRouteState.createCalls, 2);
  assert.ok(objectGeometryRouteState.createDeadlineAt! > Date.now());
  assert.ok(objectGeometryRouteState.statusDeadlineAt! > Date.now());
  assert.ok(objectGeometryRouteState.resultDeadlineAt! > Date.now());
});

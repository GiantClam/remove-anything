import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import { TINY_PNG_BYTES } from "../support/image-fixtures";
import { objectInputImageState } from "../support/object-input-image-stubs";

const inputPromise = import("../../lib/remove-objects/input-image");
const originalFetch = globalThis.fetch;
const originalEnvironment = {
  R2_URL_BASE: process.env.R2_URL_BASE,
  R2_BUCKET: process.env.R2_BUCKET,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  RUNNINGHUB_OUTPUT_URL_PREFIXES: process.env.RUNNINGHUB_OUTPUT_URL_PREFIXES,
  IMAGE_INPUT_ALLOWED_ORIGINS: process.env.IMAGE_INPUT_ALLOWED_ORIGINS,
};

const imageOptions = {
  maxBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ["image/png"],
  maxPixels: 40_000_000,
};

beforeEach(() => {
  objectInputImageState.reset();
  process.env.R2_URL_BASE = "https://files.example.test";
  process.env.R2_BUCKET = "remove-anything-test";
  process.env.R2_ENDPOINT = "https://r2-s3.example.test";
  process.env.RUNNINGHUB_OUTPUT_URL_PREFIXES =
    "https://provider.example.test/outputs";
  delete process.env.IMAGE_INPUT_ALLOWED_ORIGINS;
  globalThis.fetch = async (input) => {
    objectInputImageState.fetchUrls.push(String(input));
    return new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("private R2 inputs are read and submitted through a short-lived signed URL", async () => {
  const { readRemoveObjectsImage } = await inputPromise;
  const prepared = await readRemoveObjectsImage(
    "https://files.example.test/uploads/source.png",
    imageOptions,
  );

  assert.equal(prepared.providerUrl, objectInputImageState.fetchUrls[0]);
  assert.equal(prepared.providerUrl.includes("signature=test"), true);
  assert.deepEqual(objectInputImageState.signedCalls, [
    {
      key: "uploads/source.png",
      bucket: "remove-anything-test",
      expiresIn: 3600,
    },
  ]);
});

test("approved RunningHub output prefixes can be used as the next workflow input", async () => {
  const { readRemoveObjectsImage } = await inputPromise;
  const providerUrl = "https://provider.example.test/outputs/mask.png";
  const prepared = await readRemoveObjectsImage(providerUrl, {
    ...imageOptions,
    allowedMimeTypes: ["image/png"],
  });

  assert.equal(prepared.providerUrl, providerUrl);
  assert.deepEqual(objectInputImageState.fetchUrls, [providerUrl]);
  assert.deepEqual(objectInputImageState.allowlistChecks, [
    { value: providerUrl, prefixes: "https://provider.example.test/outputs" },
  ]);
});

test("a provider origin does not authorize an output outside its configured path", async () => {
  const { readRemoveObjectsImage } = await inputPromise;
  await assert.rejects(
    readRemoveObjectsImage(
      "https://provider.example.test/private/mask.png",
      imageOptions,
    ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "UNTRUSTED_IMAGE_URL",
  );
  assert.deepEqual(objectInputImageState.fetchUrls, []);
  assert.equal(objectInputImageState.allowlistChecks.length, 1);
});

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";

import { TINY_PNG_BYTES } from "../support/image-fixtures";
import { privateR2ImageState } from "../support/private-r2-image-input-stubs";

const inputPromise = import("../../lib/private-r2-image-input");
const originalFetch = globalThis.fetch;
const originalEnvironment = {
  R2_URL_BASE: process.env.R2_URL_BASE,
  R2_BUCKET: process.env.R2_BUCKET,
  IMAGE_INPUT_ALLOWED_ORIGINS: process.env.IMAGE_INPUT_ALLOWED_ORIGINS,
};

const imageOptions = {
  maxBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ["image/png"],
  maxPixels: 40_000_000,
};

beforeEach(() => {
  privateR2ImageState.reset();
  process.env.R2_URL_BASE = "https://files.example.test";
  process.env.R2_BUCKET = "remove-anything-test";
  delete process.env.IMAGE_INPUT_ALLOWED_ORIGINS;
  globalThis.fetch = async (input) =>
    new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
      status: 200,
    });
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("private R2 composition sources are read through a short-lived signed URL", async () => {
  const fetchUrls: string[] = [];
  globalThis.fetch = async (input) => {
    fetchUrls.push(String(input));
    return new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
  };

  const { readTrustedImageAllowingPrivateR2 } = await inputPromise;
  await readTrustedImageAllowingPrivateR2(
    "https://files.example.test/background-removal/processed/cutout.png",
    imageOptions,
  );

  assert.deepEqual(privateR2ImageState.signedCalls, [
    {
      key: "background-removal/processed/cutout.png",
      bucket: "remove-anything-test",
      expiresIn: 60,
    },
  ]);
  assert.equal(fetchUrls.length, 1);
  assert.equal(fetchUrls[0].includes("signature=test"), true);
  assert.equal(fetchUrls[0].includes("r2-s3.example.test"), true);
});

test("non-R2 trusted origins still use a bare trusted fetch", async () => {
  process.env.IMAGE_INPUT_ALLOWED_ORIGINS = "https://cdn.example.test";
  const fetchUrls: string[] = [];
  globalThis.fetch = async (input) => {
    fetchUrls.push(String(input));
    return new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
  };

  const { readTrustedImageAllowingPrivateR2 } = await inputPromise;
  await readTrustedImageAllowingPrivateR2(
    "https://cdn.example.test/public.png",
    imageOptions,
  );

  assert.deepEqual(privateR2ImageState.signedCalls, []);
  assert.deepEqual(fetchUrls, ["https://cdn.example.test/public.png"]);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  IMAGE_INPUT_MAX_PIXELS,
  ImageInputError,
  readTrustedRemoteImage,
  validateImageFile,
} from "../../lib/image-input";
import { TINY_PNG_BYTES, WIDE_PNG_BYTES } from "../support/image-fixtures";

const options = {
  maxBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
};
const environment = {
  R2_URL_BASE: "https://files.example.test/uploads",
  NEXT_PUBLIC_APP_URL: "https://app.example.test",
  NEXTAUTH_URL: "https://auth.example.test",
  IMAGE_INPUT_ALLOWED_ORIGINS:
    "https://extra.example.test,https://other.example.test",
};
function imageFile(bytes = TINY_PNG_BYTES, type = "image/png") {
  return new File([new Uint8Array(bytes)], "image.png", { type });
}
function inputError(code: string, status: number) {
  return (error: unknown) =>
    error instanceof ImageInputError &&
    error.code === code &&
    error.status === status;
}

test("image validator decodes real PNG pixels and returns canonical MIME", async () => {
  const image = await validateImageFile(imageFile(), options);
  assert.equal(image.width, 1);
  assert.equal(image.height, 1);
  assert.equal(image.contentType, "image/png");
  assert.deepEqual(image.bytes, TINY_PNG_BYTES);
  assert.equal(IMAGE_INPUT_MAX_PIXELS, 40_000_000);
});

test("image validator rejects oversized bytes, MIME spoofing, corrupt pixels, and pixel-limit excess", async () => {
  await assert.rejects(
    validateImageFile(imageFile(), { ...options, maxBytes: 1 }),
    inputError("FILE_TOO_LARGE", 413),
  );
  await assert.rejects(
    validateImageFile(imageFile(TINY_PNG_BYTES, "image/jpeg"), options),
    inputError("UNSUPPORTED_IMAGE_FORMAT", 415),
  );
  await assert.rejects(
    validateImageFile(imageFile(TINY_PNG_BYTES.slice(0, 60)), options),
    inputError("UNSUPPORTED_IMAGE_FORMAT", 415),
  );
  await assert.rejects(
    validateImageFile(imageFile(WIDE_PNG_BYTES), { ...options, maxPixels: 1 }),
    inputError("IMAGE_DIMENSIONS_TOO_LARGE", 413),
  );
  await assert.rejects(
    validateImageFile(imageFile(), {
      ...options,
      allowedMimeTypes: ["image/jpeg"],
    }),
    inputError("UNSUPPORTED_IMAGE_FORMAT", 415),
  );
});

test("remote reader permits only configured exact HTTPS origins with no credentials or fragment", async () => {
  let fetchCalls = 0;
  const fetchImpl: typeof fetch = async (_url, init) => {
    fetchCalls++;
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(new Uint8Array(TINY_PNG_BYTES), {
      headers: { "content-type": "image/png" },
    });
  };
  for (const origin of [
    "https://files.example.test",
    "https://app.example.test",
    "https://auth.example.test",
    "https://extra.example.test",
    "https://other.example.test",
  ]) {
    assert.equal(
      (
        await readTrustedRemoteImage(
          `${origin}/image.png?signature=example`,
          options,
          { environment, fetchImpl },
        )
      ).width,
      1,
    );
  }
  const acceptedCalls = fetchCalls;
  for (const url of [
    "http://files.example.test/image.png",
    "https://files.example.test.attacker.test/image.png",
    "https://files.example.test:8443/image.png",
    "https://user:password@files.example.test/image.png",
    "https://files.example.test/image.png#",
    "https://files.example.test/image.png#fragment",
    "file:///tmp/image.png",
    "http://127.0.0.1/image.png",
    "not-a-url",
  ]) {
    await assert.rejects(
      readTrustedRemoteImage(url, options, { environment, fetchImpl }),
      inputError("UNTRUSTED_IMAGE_URL", 400),
    );
  }
  assert.equal(fetchCalls, acceptedCalls);
});

test("remote reader does not trust declared size, MIME, redirects, or transport errors", async () => {
  const read = (fetchImpl: typeof fetch, maxBytes = options.maxBytes) =>
    readTrustedRemoteImage(
      "https://files.example.test/image.png",
      { ...options, maxBytes },
      { environment, fetchImpl },
    );
  await assert.rejects(
    read(
      async () =>
        new Response(TINY_PNG_BYTES, {
          headers: {
            "content-type": "image/png",
            "content-length": String(options.maxBytes + 1),
          },
        }),
    ),
    inputError("FILE_TOO_LARGE", 413),
  );
  await assert.rejects(
    read(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(4));
              controller.enqueue(new Uint8Array(4));
              controller.close();
            },
          }),
          { headers: { "content-type": "image/png", "content-length": "1" } },
        ),
      5,
    ),
    inputError("FILE_TOO_LARGE", 413),
  );
  await assert.rejects(
    read(
      async () =>
        new Response(TINY_PNG_BYTES, {
          headers: { "content-type": "image/jpeg" },
        }),
    ),
    inputError("UNSUPPORTED_IMAGE_FORMAT", 415),
  );
  await assert.rejects(
    read(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://other.example.test/image.png" },
        }),
    ),
    inputError("IMAGE_FETCH_FAILED", 400),
  );
  await assert.rejects(
    read(async () => {
      throw new TypeError("redirect rejected");
    }),
    inputError("IMAGE_FETCH_FAILED", 400),
  );
});

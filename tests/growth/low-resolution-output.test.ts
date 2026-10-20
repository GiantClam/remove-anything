import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import sharp from "sharp";

import {
  createLowResolutionImage,
  createLowResolutionImageZip,
  LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX,
  UnsupportedOutputFormatError,
} from "../../lib/low-resolution-output";

async function largePng() {
  return new Uint8Array(
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
}

test("image outputs are decoded and resized to the server tier within byte limits", async () => {
  const source = await largePng();
  const output = await createLowResolutionImage(
    source,
    "image/png; charset=binary",
    10 * 1024 * 1024,
  );
  const metadata = await sharp(output.bytes).metadata();

  assert.equal(output.contentType, "image/png");
  assert.ok(metadata.width! <= LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX);
  assert.ok(metadata.height! <= LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX);
  assert.ok(output.bytes.byteLength <= 10 * 1024 * 1024);
  assert.notEqual(metadata.width, 2048);
});

test("image outputs reject unsupported formats and oversized re-encoded data", async () => {
  const source = await largePng();
  await assert.rejects(
    createLowResolutionImage(source, "image/svg+xml", 10 * 1024 * 1024),
    UnsupportedOutputFormatError,
  );
  await assert.rejects(
    createLowResolutionImage(source, "image/png", 1),
    /supported output size/,
  );
});

test("watermark ZIPs are rebuilt from resized image members", async () => {
  const zip = new JSZip();
  zip.file("nested/result.png", await largePng());
  const source = await zip.generateAsync({ type: "uint8array" });
  const output = await createLowResolutionImageZip(source, 10 * 1024 * 1024);
  const rebuilt = await JSZip.loadAsync(output.bytes);
  const imageBytes = await rebuilt.file("result.png")!.async("uint8array");
  const metadata = await sharp(imageBytes).metadata();

  assert.ok(metadata.width! <= LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX);
  assert.ok(metadata.height! <= LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX);
  assert.ok(output.bytes.byteLength <= 10 * 1024 * 1024);
  assert.ok(output.preview.bytes.byteLength > 0);
});

test("watermark ZIP rejects non-image members", async () => {
  const zip = new JSZip();
  zip.file("payload.txt", "not an image");
  const source = await zip.generateAsync({ type: "uint8array" });
  await assert.rejects(
    createLowResolutionImageZip(source, 10 * 1024 * 1024),
    UnsupportedOutputFormatError,
  );
});

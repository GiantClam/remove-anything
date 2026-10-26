import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { composeObjectClearInput } from "../../lib/remove-objects/rgba-input";

test("ObjectClear input keeps RGB pixels and uses the PNG mask as alpha", async () => {
  const source = await sharp({
    create: { width: 2, height: 1, channels: 3, background: { r: 10, g: 20, b: 30 } },
  }).png().toBuffer();
  const mask = await sharp({
    create: { width: 2, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  }).png().toBuffer();
  const maskWithValues = await sharp(mask).raw().toBuffer({ resolveWithObject: true });
  maskWithValues.data[0] = 0;
  maskWithValues.data[1] = 0;
  maskWithValues.data[2] = 0;
  maskWithValues.data[4] = 255;
  maskWithValues.data[5] = 255;
  maskWithValues.data[6] = 255;
  const maskPng = await sharp(maskWithValues.data, {
    raw: { width: 2, height: 1, channels: 4 },
  }).png().toBuffer();

  const result = await composeObjectClearInput(
    {
      file: new File([source], "source.png", { type: "image/png" }),
      bytes: new Uint8Array(source),
      contentType: "image/png",
      width: 2,
      height: 1,
    },
    {
      file: new File([maskPng], "mask.png", { type: "image/png" }),
      bytes: new Uint8Array(maskPng),
      contentType: "image/png",
      width: 2,
      height: 1,
    },
  );
  const decoded = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.channels, 4);
  assert.deepEqual(Array.from(decoded.data), [10, 20, 30, 0, 10, 20, 30, 255]);
});

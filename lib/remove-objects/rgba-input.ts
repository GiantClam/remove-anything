import sharp from "sharp";

import type { ValidatedImageInput } from "@/lib/image-input";

/**
 * ObjectClear consumes one RGBA image. The source RGB pixels remain intact and
 * the selected object mask becomes the alpha channel that the workflow reads.
 */
export async function composeObjectClearInput(
  image: ValidatedImageInput,
  mask: ValidatedImageInput,
): Promise<Buffer> {
  if (image.width !== mask.width || image.height !== mask.height) {
    throw new Error("The image and PNG mask must have the same dimensions");
  }

  const maskRaw = await sharp(Buffer.from(mask.bytes))
    .removeAlpha()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return sharp(Buffer.from(image.bytes))
    .ensureAlpha()
    .joinChannel(maskRaw.data, {
      raw: {
        width: maskRaw.info.width,
        height: maskRaw.info.height,
        channels: 1,
      },
    })
    .png()
    .toBuffer();
}

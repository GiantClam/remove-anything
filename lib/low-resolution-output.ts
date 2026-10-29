import "server-only";

import sharp from "sharp";

import { ResultSizeLimitError } from "@/lib/limited-response";

export const LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX = 1024;
const MAX_OUTPUT_PIXELS = 40_000_000;
const MAX_ZIP_EXPANDED_BYTES = 50 * 1024 * 1024;

export class UnsupportedOutputFormatError extends Error {
  constructor(message = "Result is not a supported image or image ZIP") {
    super(message);
    this.name = "UnsupportedOutputFormatError";
  }
}

export type SupportedImageContentType =
  | "image/png"
  | "image/jpeg"
  | "image/webp";

function imageFormat(contentType: string): SupportedImageContentType {
  const normalized = contentType.split(";", 1)[0].trim().toLowerCase();
  if (
    normalized === "image/png" ||
    normalized === "image/jpeg" ||
    normalized === "image/webp"
  ) {
    return normalized;
  }
  throw new UnsupportedOutputFormatError("Result is not a supported image");
}

/**
 * Produce the bounded preview image tier. Free and anonymous downloads must
 * go through this path so raw provider dimensions never reach the browser.
 */
export async function createLowResolutionImage(
  input: Uint8Array,
  contentType: string,
  maxOutputBytes: number,
) {
  const format = imageFormat(contentType);
  const image = sharp(Buffer.from(input), {
    limitInputPixels: MAX_OUTPUT_PIXELS,
    failOn: "error",
  })
    .rotate()
    .resize({
      width: LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX,
      height: LOW_RESOLUTION_OUTPUT_MAX_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    });

  const output =
    format === "image/png"
      ? await image.png().toBuffer()
      : format === "image/jpeg"
        ? await image.jpeg().toBuffer()
        : await image.webp().toBuffer();
  if (output.byteLength > maxOutputBytes) {
    throw new ResultSizeLimitError(maxOutputBytes);
  }
  const metadata = await sharp(output).metadata();
  if (!metadata.width || !metadata.height) {
    throw new UnsupportedOutputFormatError(
      "Result image dimensions are missing",
    );
  }
  return {
    bytes: new Uint8Array(output),
    contentType: format,
    width: metadata.width,
    height: metadata.height,
  };
}

function zipEntryExpandedSize(entry: unknown) {
  const data = (
    entry as unknown as {
      _data?: { uncompressedSize?: unknown };
    }
  )._data;
  const size = data?.uncompressedSize;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) {
    throw new UnsupportedOutputFormatError("ZIP member size is invalid");
  }
  return size;
}

function zipEntryType(name: string): SupportedImageContentType {
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  throw new UnsupportedOutputFormatError(
    "ZIP contains a file that is not a supported image",
  );
}

function safeZipName(
  name: string,
  index: number,
  contentType: SupportedImageContentType,
) {
  const extension =
    contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const basename =
    name.split(/[\\/]/).at(-1) || `image-${index + 1}.${extension}`;
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return safe || `image-${index + 1}.${extension}`;
}

/**
 * Rebuild a provider ZIP with bounded, downscaled image members. Member sizes
 * are checked before decompression; unsupported payloads fail closed instead
 * of slipping a full-size or non-image file through the free download route.
 */
export async function createLowResolutionImageZip(
  input: Uint8Array,
  maxOutputBytes: number,
) {
  const JSZip = (await import("jszip")).default;
  let source: InstanceType<typeof JSZip>;
  try {
    source = await JSZip.loadAsync(input, { checkCRC32: false });
  } catch {
    throw new UnsupportedOutputFormatError("Result is not a valid ZIP archive");
  }

  const entries = Object.values(source.files).filter((entry) => !entry.dir);
  if (entries.length === 0) {
    throw new UnsupportedOutputFormatError("ZIP contains no image files");
  }

  let expandedBytes = 0;
  for (const entry of entries) {
    const size = zipEntryExpandedSize(entry);
    expandedBytes += size;
    if (expandedBytes > MAX_ZIP_EXPANDED_BYTES) {
      throw new UnsupportedOutputFormatError(
        "ZIP expands beyond the supported size",
      );
    }
    zipEntryType(entry.name);
  }

  const output = new JSZip();
  let preview:
    | { bytes: Uint8Array; contentType: SupportedImageContentType }
    | undefined;
  for (const [index, entry] of entries.entries()) {
    const contentType = zipEntryType(entry.name);
    const member = await entry.async("uint8array");
    if (member.byteLength !== zipEntryExpandedSize(entry)) {
      throw new UnsupportedOutputFormatError(
        "ZIP member size does not match its directory",
      );
    }
    const resized = await createLowResolutionImage(
      member,
      contentType,
      maxOutputBytes,
    );
    if (!preview)
      preview = { bytes: resized.bytes, contentType: resized.contentType };
    output.file(safeZipName(entry.name, index, contentType), resized.bytes, {
      date: new Date("1980-01-01T00:00:00.000Z"),
    });
  }

  const bytes = await output.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  if (bytes.byteLength > maxOutputBytes) {
    throw new ResultSizeLimitError(maxOutputBytes);
  }
  if (!preview)
    throw new UnsupportedOutputFormatError("ZIP contains no image files");
  return { bytes, preview };
}

/**
 * Deliver the stored result bytes without downscaling. Callers must already
 * have passed `assertOutputEntitlement` for tier "full". Still enforces the
 * registry maxOutputBytes and supported image MIME types.
 */
export async function createFullResolutionImage(
  input: Uint8Array,
  contentType: string,
  maxOutputBytes: number,
) {
  const format = imageFormat(contentType);
  if (input.byteLength > maxOutputBytes) {
    throw new ResultSizeLimitError(maxOutputBytes);
  }
  const metadata = await sharp(Buffer.from(input), {
    limitInputPixels: MAX_OUTPUT_PIXELS,
    failOn: "error",
  }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new UnsupportedOutputFormatError(
      "Result image dimensions are missing",
    );
  }
  return {
    bytes: input,
    contentType: format,
    width: metadata.width,
    height: metadata.height,
  };
}

/**
 * Deliver a ZIP without downscaling members. Validates ZIP structure and that
 * members are supported images, then returns the original archive bytes.
 */
export async function createFullResolutionImageZip(
  input: Uint8Array,
  maxOutputBytes: number,
) {
  if (input.byteLength > maxOutputBytes) {
    throw new ResultSizeLimitError(maxOutputBytes);
  }
  const JSZip = (await import("jszip")).default;
  let source: InstanceType<typeof JSZip>;
  try {
    source = await JSZip.loadAsync(input, { checkCRC32: false });
  } catch {
    throw new UnsupportedOutputFormatError("Result is not a valid ZIP archive");
  }

  const entries = Object.values(source.files).filter((entry) => !entry.dir);
  if (entries.length === 0) {
    throw new UnsupportedOutputFormatError("ZIP contains no image files");
  }

  let expandedBytes = 0;
  let preview:
    | { bytes: Uint8Array; contentType: SupportedImageContentType }
    | undefined;
  for (const entry of entries) {
    const size = zipEntryExpandedSize(entry);
    expandedBytes += size;
    if (expandedBytes > MAX_ZIP_EXPANDED_BYTES) {
      throw new UnsupportedOutputFormatError(
        "ZIP expands beyond the supported size",
      );
    }
    const contentType = zipEntryType(entry.name);
    if (!preview) {
      const member = await entry.async("uint8array");
      if (member.byteLength !== size) {
        throw new UnsupportedOutputFormatError(
          "ZIP member size does not match its directory",
        );
      }
      preview = { bytes: member, contentType };
    }
  }
  if (!preview)
    throw new UnsupportedOutputFormatError("ZIP contains no image files");
  return { bytes: input, preview };
}

export async function materializeImageOutput(args: {
  tier: "preview" | "full";
  input: Uint8Array;
  contentType: string;
  maxOutputBytes: number;
}) {
  if (args.tier === "full") {
    return createFullResolutionImage(
      args.input,
      args.contentType,
      args.maxOutputBytes,
    );
  }
  return createLowResolutionImage(
    args.input,
    args.contentType,
    args.maxOutputBytes,
  );
}

export async function materializeImageZipOutput(args: {
  tier: "preview" | "full";
  input: Uint8Array;
  maxOutputBytes: number;
}) {
  if (args.tier === "full") {
    return createFullResolutionImageZip(args.input, args.maxOutputBytes);
  }
  return createLowResolutionImageZip(args.input, args.maxOutputBytes);
}

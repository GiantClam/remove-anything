import "server-only";

import sharp from "sharp";

import {
  readLimitedResponse,
  ResultSizeLimitError,
} from "@/lib/limited-response";

/** Decoder safety limit; this does not approve a provider cost or paid output. */
export const IMAGE_INPUT_MAX_PIXELS = 40_000_000;
export const IMAGE_INPUT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
type ImageMimeType = (typeof IMAGE_INPUT_MIME_TYPES)[number];

export class ImageInputError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ImageInputError";
  }
}

export type ImageInputOptions = {
  maxBytes: number;
  allowedMimeTypes?: readonly string[];
  maxPixels?: number;
};

export type ValidatedImageInput = {
  file: File;
  bytes: Uint8Array;
  contentType: ImageMimeType;
  width: number;
  height: number;
};

function sizeError(maxBytes: number) {
  return new ImageInputError(
    "FILE_TOO_LARGE",
    `Each file must be ${maxBytes / 1024 / 1024}MB or smaller`,
    413,
  );
}

function formatError() {
  return new ImageInputError(
    "UNSUPPORTED_IMAGE_FORMAT",
    "Upload a valid JPEG, PNG, or WebP image with its correct content type",
    415,
  );
}

function validateOptions(options: ImageInputOptions) {
  const maxPixels = options.maxPixels ?? IMAGE_INPUT_MAX_PIXELS;
  if (
    !Number.isSafeInteger(options.maxBytes) ||
    options.maxBytes <= 0 ||
    !Number.isSafeInteger(maxPixels) ||
    maxPixels <= 0 ||
    maxPixels > IMAGE_INPUT_MAX_PIXELS
  ) {
    throw new Error("Invalid image input limits");
  }
  return {
    maxPixels,
    allowedMimeTypes: options.allowedMimeTypes ?? IMAGE_INPUT_MIME_TYPES,
  };
}

/** Validate bytes with a real decoder, rather than trusting a filename or MIME header. */
export async function validateImageFile(
  file: File,
  options: ImageInputOptions,
): Promise<ValidatedImageInput> {
  const { maxPixels, allowedMimeTypes } = validateOptions(options);
  if (!(file instanceof File))
    throw new ImageInputError(
      "IMAGE_REQUIRED",
      "An image file is required",
      400,
    );
  if (file.size > options.maxBytes) throw sizeError(options.maxBytes);
  const declaredType = file.type.split(";", 1)[0].trim().toLowerCase();
  if (
    !(IMAGE_INPUT_MIME_TYPES as readonly string[]).includes(declaredType) ||
    !allowedMimeTypes.includes(declaredType)
  )
    throw formatError();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > options.maxBytes) throw sizeError(options.maxBytes);
  try {
    const decoder = sharp(bytes, {
      limitInputPixels: maxPixels,
      failOn: "error",
    });
    const metadata = await decoder.metadata();
    const contentType =
      metadata.format === "jpeg"
        ? "image/jpeg"
        : metadata.format === "png"
          ? "image/png"
          : metadata.format === "webp"
            ? "image/webp"
            : null;
    if (
      !contentType ||
      contentType !== declaredType ||
      !allowedMimeTypes.includes(contentType) ||
      (metadata.pages ?? 1) !== 1
    )
      throw formatError();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0
    )
      throw formatError();
    if (width * height > maxPixels)
      throw new ImageInputError(
        "IMAGE_DIMENSIONS_TOO_LARGE",
        `Image exceeds the ${maxPixels / 1_000_000}MP input safety limit`,
        413,
      );
    // metadata() alone accepts some truncated images; stats() forces decoding.
    await decoder.stats();
    return {
      file: new File([bytes], file.name, { type: contentType }),
      bytes,
      contentType,
      width,
      height,
    };
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      throw new ImageInputError(
        "IMAGE_DIMENSIONS_TOO_LARGE",
        `Image exceeds the ${maxPixels / 1_000_000}MP input safety limit`,
        413,
      );
    }
    throw formatError();
  }
}

type RemoteImageDependencies = {
  environment?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
};

function trustedOrigins(environment: Record<string, string | undefined>) {
  const configured = [
    environment.R2_URL_BASE,
    environment.NEXT_PUBLIC_APP_URL,
    environment.NEXTAUTH_URL,
    ...(environment.IMAGE_INPUT_ALLOWED_ORIGINS ?? "").split(/[\s,]+/),
  ];
  const origins = new Set<string>();
  for (const value of configured) {
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (
        parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        !parsed.hash
      )
        origins.add(parsed.origin);
    } catch {
      // Invalid configuration never widens the allowed origin set.
    }
  }
  return origins;
}

/** Read only operator-controlled HTTPS origins; arbitrary URLs must be uploaded. */
export async function readTrustedRemoteImage(
  url: unknown,
  options: ImageInputOptions,
  dependencies: RemoteImageDependencies = {},
): Promise<ValidatedImageInput> {
  validateOptions(options);
  let parsed: URL;
  try {
    if (typeof url !== "string" || url.includes("#"))
      throw new Error("Invalid URL");
    parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !trustedOrigins(dependencies.environment ?? process.env).has(
        parsed.origin,
      )
    )
      throw new Error("Untrusted origin");
  } catch {
    throw new ImageInputError(
      "UNTRUSTED_IMAGE_URL",
      "Use a trusted image URL or upload the image file instead",
      400,
    );
  }
  try {
    const response = await (dependencies.fetchImpl ?? fetch)(parsed.href, {
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || response.redirected)
      throw new ImageInputError(
        "IMAGE_FETCH_FAILED",
        "Unable to read this image URL; upload the image file instead",
        400,
      );
    const bytes = await readLimitedResponse(response, options.maxBytes);
    const contentType =
      response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase() ?? "";
    const extension =
      contentType === "image/jpeg"
        ? "jpg"
        : contentType === "image/png"
          ? "png"
          : contentType === "image/webp"
            ? "webp"
            : "img";
    return await validateImageFile(
      new File([new Uint8Array(bytes)], `image.${extension}`, {
        type: contentType,
      }),
      options,
    );
  } catch (error) {
    if (error instanceof ResultSizeLimitError)
      throw sizeError(options.maxBytes);
    if (error instanceof ImageInputError) throw error;
    throw new ImageInputError(
      "IMAGE_FETCH_FAILED",
      "Unable to read this image URL; upload the image file instead",
      400,
    );
  }
}

import "server-only";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  IMAGE_INPUT_MIME_TYPES,
  ImageInputError,
  validateImageFile,
} from "@/lib/image-input";
import {
  readLimitedResponse,
  ResultSizeLimitError,
} from "@/lib/limited-response";
import { getToolRegistryEntry } from "@/lib/tool-registry";

const MAX_COMPOSITION_REQUEST_BYTES = 15 * 1024 * 1024;
const MAX_REFERENCE_URL_LENGTH = 4_096;
const MAX_TEMPLATE_ID_LENGTH = 128;
const MAX_POSITION = 200;
const MAX_ROTATION = 360;
const ALLOWED_BLEND_MODES = [
  "normal",
  "multiply",
  "overlay",
  "screen",
  "darken",
  "lighten",
] as const;

export class CompositionInputError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CompositionInputError";
  }
}

function invalidCompositionInput() {
  return new CompositionInputError(
    "INVALID_COMPOSITION_INPUT",
    "Provide valid composition settings and image references",
    400,
  );
}

function requestTooLarge() {
  return new CompositionInputError(
    "PAYLOAD_TOO_LARGE",
    "Composition request exceeds the supported size",
    413,
  );
}

function isSafeImageReference(value: string) {
  if (
    !value ||
    value.length > MAX_REFERENCE_URL_LENGTH ||
    value.trim() !== value ||
    /[\u0000-\u001f\\]/.test(value) ||
    value.includes("#")
  ) {
    return false;
  }

  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) {
      return false;
    }

    // Composition images are fetched by the browser and may be persisted in
    // the result record. Restrict remote references to operator-configured
    // exact origins so arbitrary URLs cannot become a storage/SSRF bypass.
    const configuredOrigins = [
      process.env.R2_URL_BASE,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXTAUTH_URL,
      ...(process.env.IMAGE_INPUT_ALLOWED_ORIGINS ?? "").split(/[\s,]+/),
    ];
    const origins = new Set<string>();
    for (const candidate of configuredOrigins) {
      if (!candidate) continue;
      try {
        const configured = new URL(candidate);
        if (
          configured.protocol === "https:" &&
          !configured.username &&
          !configured.password &&
          !configured.hash
        ) {
          origins.add(configured.origin);
        }
      } catch {
        // Invalid configuration must not widen the allowlist.
      }
    }
    return origins.has(url.origin);
  } catch {
    return false;
  }
}

const colorSchema = z
  .string()
  .max(32)
  .regex(/^#[\da-f]{3}(?:[\da-f]{3}|[\da-f]{5})?$/i);

const positionSchema = z
  .object({
    x: z.number().finite().min(-MAX_POSITION).max(MAX_POSITION),
    y: z.number().finite().min(-MAX_POSITION).max(MAX_POSITION),
  })
  .strict();

const compositionParamsSchema = z.union([
  // Accept the original route's small { x, y } shape while the UI sends the
  // full image-composer shape below.
  z.object({ x: positionSchema.shape.x, y: positionSchema.shape.y }).strict(),
  z
    .object({
      position: positionSchema,
      scale: z.number().finite().min(0.1).max(3),
      rotation: z.number().finite().min(-MAX_ROTATION).max(MAX_ROTATION),
      blendMode: z.enum(ALLOWED_BLEND_MODES).optional(),
    })
    .strict(),
]);

const backgroundTypeSchema = z.enum([
  "solid",
  "color", // legacy route value
  "gradient",
  "image",
  "template",
]);

const createCompositionBaseSchema = z.object({
  foregroundImageUrl: z
    .string()
    .min(1)
    .max(MAX_REFERENCE_URL_LENGTH)
    .refine(isSafeImageReference),
  backgroundType: backgroundTypeSchema,
  backgroundData: z.unknown(),
  compositionParams: compositionParamsSchema,
});

const updateCompositionSchema = z.object({
  compositionId: z.number().int().positive().safe(),
  resultImageDataUrl: z.string().min(1).max(MAX_COMPOSITION_REQUEST_BYTES),
});

export type CreateCompositionInput = Omit<
  z.infer<typeof createCompositionBaseSchema>,
  "backgroundData"
> & { backgroundData: Prisma.InputJsonValue };

export type UpdateCompositionInput = z.infer<typeof updateCompositionSchema>;

function parseBackgroundData(
  type: z.infer<typeof backgroundTypeSchema>,
  value: unknown,
) {
  let schema: z.ZodTypeAny;
  switch (type) {
    case "solid":
      schema = z.object({ color: colorSchema }).strict();
      break;
    case "color":
      schema = z.union([
        colorSchema,
        z.object({ color: colorSchema }).strict(),
      ]);
      break;
    case "gradient":
      schema = z
        .object({
          gradient: z
            .object({
              type: z.enum(["linear", "radial"]),
              colors: z.array(colorSchema).min(2).max(8),
              direction: z
                .number()
                .finite()
                .min(-MAX_ROTATION)
                .max(MAX_ROTATION)
                .optional(),
            })
            .strict(),
        })
        .strict();
      break;
    case "image":
      schema = z
        .object({
          imageUrl: z
            .string()
            .min(1)
            .max(MAX_REFERENCE_URL_LENGTH)
            .refine(isSafeImageReference),
        })
        .strict();
      break;
    case "template":
      schema = z
        .object({
          templateId: z.string().min(1).max(MAX_TEMPLATE_ID_LENGTH),
          imageUrl: z.string().min(1).max(MAX_REFERENCE_URL_LENGTH).optional(),
        })
        .strict();
      break;
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidCompositionInput();
  return parsed.data as Prisma.InputJsonValue;
}

function getImageLimits() {
  const tool = getToolRegistryEntry("remove-background");
  if (!tool) {
    throw new CompositionInputError(
      "TOOL_CONFIG_UNAVAILABLE",
      "Image validation settings are unavailable",
      503,
    );
  }
  return {
    maxBytes: tool.limits.maxOutputSizeMb * 1024 * 1024,
    maxPixels: tool.limits.maxPixels,
  };
}

type ParsedImageDataUrl = {
  base64: string;
  contentType: string;
  expectedByteLength: number;
};

function parseImageDataUrl(
  value: string,
  allowedMimeTypes: readonly string[],
): ParsedImageDataUrl {
  const comma = value.indexOf(",");
  if (comma < 0 || comma > 128) {
    throw new ImageInputError(
      "UNSUPPORTED_IMAGE_FORMAT",
      "Provide a valid base64 image data URL",
      415,
    );
  }

  const header = value.slice(0, comma);
  const match = /^data:(image\/[a-z0-9.+-]+);base64$/i.exec(header);
  if (!match) {
    throw new ImageInputError(
      "UNSUPPORTED_IMAGE_FORMAT",
      "Provide a valid base64 image data URL",
      415,
    );
  }
  const contentType = match[1].toLowerCase();
  if (
    !(IMAGE_INPUT_MIME_TYPES as readonly string[]).includes(contentType) ||
    !allowedMimeTypes.includes(contentType)
  ) {
    throw new ImageInputError(
      "UNSUPPORTED_IMAGE_FORMAT",
      "Upload a valid JPEG, PNG, or WebP image with its correct content type",
      415,
    );
  }

  const base64 = value.slice(comma + 1);
  const { maxBytes } = getImageLimits();
  const maxEncodedBytes = 4 * Math.ceil(maxBytes / 3);
  if (base64.length > maxEncodedBytes) {
    throw new ImageInputError(
      "FILE_TOO_LARGE",
      `Image must be ${maxBytes / 1024 / 1024}MB or smaller`,
      413,
    );
  }
  if (
    base64.length === 0 ||
    base64.length % 4 !== 0 ||
    /[^A-Za-z0-9+/=]/.test(base64)
  ) {
    throw new CompositionInputError(
      "INVALID_IMAGE_DATA",
      "Image data is not valid base64",
      400,
    );
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const expectedByteLength = (base64.length / 4) * 3 - padding;
  if (expectedByteLength > maxBytes) {
    throw new ImageInputError(
      "FILE_TOO_LARGE",
      `Image must be ${maxBytes / 1024 / 1024}MB or smaller`,
      413,
    );
  }
  if (expectedByteLength <= 0) {
    throw new CompositionInputError(
      "INVALID_IMAGE_DATA",
      "Image data is empty",
      400,
    );
  }

  return { base64, contentType, expectedByteLength };
}

export async function readCompositionJson(request: Request): Promise<unknown> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new CompositionInputError(
      "UNSUPPORTED_CONTENT_TYPE",
      "Send composition data as JSON",
      415,
    );
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      throw new CompositionInputError(
        "INVALID_COMPOSITION_INPUT",
        "Invalid request size",
        400,
      );
    }
    if (Number(declaredLength) > MAX_COMPOSITION_REQUEST_BYTES)
      throw requestTooLarge();
  }

  const body = request.body;
  if (!body) throw invalidCompositionInput();
  let bytes: Uint8Array;
  try {
    bytes = await readLimitedResponse(
      new Response(body, {
        headers: declaredLength
          ? { "content-length": declaredLength }
          : undefined,
      }),
      MAX_COMPOSITION_REQUEST_BYTES,
    );
  } catch (error) {
    if (error instanceof ResultSizeLimitError) throw requestTooLarge();
    throw error;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw invalidCompositionInput();
  }
}

export function validateCreateCompositionInput(
  value: unknown,
): CreateCompositionInput {
  const parsed = createCompositionBaseSchema.safeParse(value);
  if (!parsed.success) throw invalidCompositionInput();

  const backgroundData = parseBackgroundData(
    parsed.data.backgroundType,
    parsed.data.backgroundData,
  );
  const backgroundObject =
    typeof backgroundData === "object" &&
    backgroundData !== null &&
    !Array.isArray(backgroundData)
      ? (backgroundData as Prisma.InputJsonObject)
      : null;
  const imageUrl = backgroundObject?.imageUrl;
  const backgroundImageUrl = typeof imageUrl === "string" ? imageUrl : null;
  if (
    parsed.data.backgroundType === "template" &&
    backgroundImageUrl &&
    !isSafeImageReference(backgroundImageUrl)
  ) {
    throw invalidCompositionInput();
  }

  return { ...parsed.data, backgroundData };
}

export function validateUpdateCompositionInput(
  value: unknown,
): UpdateCompositionInput {
  const parsed = updateCompositionSchema.safeParse(value);
  if (!parsed.success) throw invalidCompositionInput();

  // Validate syntax, declared MIME, and byte count before any DB lookup. Full
  // decoding and pixel validation happens only after confirming ownership.
  parseImageDataUrl(parsed.data.resultImageDataUrl, ["image/png"]);
  return parsed.data;
}

export async function decodeCompositionImageDataUrl(
  value: string,
  allowedMimeTypes: readonly string[],
  fileName: string,
) {
  const { base64, contentType, expectedByteLength } = parseImageDataUrl(
    value,
    allowedMimeTypes,
  );
  const bytes = Buffer.from(base64, "base64");
  if (
    bytes.byteLength !== expectedByteLength ||
    bytes.toString("base64") !== base64
  ) {
    throw new CompositionInputError(
      "INVALID_IMAGE_DATA",
      "Image data is not valid base64",
      400,
    );
  }

  const limits = getImageLimits();
  return validateImageFile(new File([bytes], fileName, { type: contentType }), {
    ...limits,
    allowedMimeTypes,
  });
}

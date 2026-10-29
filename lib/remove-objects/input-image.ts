import "server-only";

import { env } from "@/env.mjs";
import {
  ImageInputError,
  readTrustedRemoteImage,
  type ImageInputOptions,
  type ValidatedImageInput,
} from "@/lib/image-input";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { createR2S3Service } from "@/lib/r2-s3";
import { isAllowedRunningHubOutput } from "@/lib/runninghub-output";

const SIGNED_INPUT_URL_TTL_SECONDS = 60 * 60;

export type PreparedRemoveObjectsImage = {
  /** The URL that is safe to submit to RunningHub. */
  providerUrl: string;
  /** The decoded image used for dimensions and format validation. */
  image: ValidatedImageInput;
};

function runtimeValue(name: keyof NodeJS.ProcessEnv, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function outputPrefixes() {
  return process.env.RUNNINGHUB_OUTPUT_URL_PREFIXES ?? env.RUNNINGHUB_OUTPUT_URL_PREFIXES;
}

/**
 * A provider origin is treated specially only when it has been configured as
 * an output prefix. This prevents a broad IMAGE_INPUT_ALLOWED_ORIGINS entry
 * from accidentally allowing arbitrary provider paths into the workflow.
 */
function hasConfiguredRunningHubOrigin(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    return false;
  }

  return (outputPrefixes() || "").split(",").some((entry) => {
    try {
      const prefix = new URL(entry.trim());
      return (
        prefix.protocol === "https:" &&
        !prefix.username &&
        !prefix.password &&
        !prefix.hash &&
        prefix.origin === parsed.origin
      );
    } catch {
      return false;
    }
  });
}

function trustedEnvironment(overrides: Record<string, string | undefined>) {
  return { ...process.env, ...overrides };
}

/**
 * Read an object-flow input and return a provider-readable URL.
 *
 * Stable R2 URLs are deliberately kept in the API/DB contract, but staging
 * and production buckets are private. They are therefore fetched and handed
 * to RunningHub through a short-lived S3 presigned URL. RunningHub callback
 * outputs are accepted only after the configured origin *and path* allowlist
 * check; the origin is then scoped into readTrustedRemoteImage for that one
 * read.
 */
export async function readRemoveObjectsImage(
  url: string,
  options: ImageInputOptions,
): Promise<PreparedRemoveObjectsImage> {
  const r2Key = getR2ObjectKey(
    url,
    runtimeValue("R2_URL_BASE", env.R2_URL_BASE),
  );
  if (r2Key) {
    const signedUrl = await createR2S3Service().getSignedUrl(
      r2Key,
      runtimeValue("R2_BUCKET", env.R2_BUCKET),
      SIGNED_INPUT_URL_TTL_SECONDS,
    );
    const image = await readTrustedRemoteImage(signedUrl, options, {
      // The presigner uses the S3 endpoint, while the stable URL uses the
      // public R2 origin. Scope the trusted origin to this generated URL.
      environment: trustedEnvironment({
        R2_URL_BASE: new URL(signedUrl).origin,
      }),
    });
    return { image, providerUrl: signedUrl };
  }

  if (hasConfiguredRunningHubOrigin(url)) {
    if (!isAllowedRunningHubOutput(url, outputPrefixes())) {
      throw new ImageInputError(
        "UNTRUSTED_IMAGE_URL",
        "Use a trusted image URL or upload the image file instead",
        400,
      );
    }

    const image = await readTrustedRemoteImage(url, options, {
      environment: trustedEnvironment({
        IMAGE_INPUT_ALLOWED_ORIGINS: [
          process.env.IMAGE_INPUT_ALLOWED_ORIGINS,
          new URL(url).origin,
        ]
          .filter(Boolean)
          .join(" "),
      }),
    });
    return { image, providerUrl: url };
  }

  const image = await readTrustedRemoteImage(url, options);
  return { image, providerUrl: url };
}

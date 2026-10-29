import "server-only";

import { env } from "@/env.mjs";
import {
  readTrustedRemoteImage,
  type ImageInputOptions,
  type ValidatedImageInput,
} from "@/lib/image-input";
import { getR2ObjectKey } from "@/lib/r2-object-key";
import { createR2S3Service } from "@/lib/r2-s3";

/** Short-lived GET for server-side ownership validation only. */
const SIGNED_READ_TTL_SECONDS = 60;

type PrivateR2ImageDependencies = {
  environment?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  createSigner?: typeof createR2S3Service;
};

function runtimeValue(
  environment: Record<string, string | undefined>,
  name: "R2_URL_BASE" | "R2_BUCKET",
  fallback: string,
) {
  return environment[name]?.trim() || fallback;
}

/**
 * Read an operator-trusted HTTPS image, including private R2 objects.
 *
 * Stable R2 URLs stay in the DB/API contract, but staging/production buckets
 * refuse bare GETs. Owner-scoped callers therefore mint a short-lived signed
 * URL for the server-side decode without making the bucket public.
 */
export async function readTrustedImageAllowingPrivateR2(
  url: string,
  options: ImageInputOptions,
  dependencies: PrivateR2ImageDependencies = {},
): Promise<ValidatedImageInput> {
  const environment = {
    ...process.env,
    ...dependencies.environment,
  };
  const r2UrlBase = runtimeValue(environment, "R2_URL_BASE", env.R2_URL_BASE);
  const r2Bucket = runtimeValue(environment, "R2_BUCKET", env.R2_BUCKET);
  const r2Key = getR2ObjectKey(url, r2UrlBase);
  if (r2Key) {
    const signer = (dependencies.createSigner ?? createR2S3Service)();
    const signedUrl = await signer.getSignedUrl(
      r2Key,
      r2Bucket,
      SIGNED_READ_TTL_SECONDS,
    );
    return readTrustedRemoteImage(signedUrl, options, {
      // Presigned GETs use the S3 endpoint origin, not R2_URL_BASE.
      environment: {
        ...environment,
        R2_URL_BASE: new URL(signedUrl).origin,
      },
      fetchImpl: dependencies.fetchImpl,
    });
  }

  return readTrustedRemoteImage(url, options, {
    environment,
    fetchImpl: dependencies.fetchImpl,
  });
}

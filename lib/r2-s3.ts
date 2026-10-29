import { env } from "@/env.mjs";
import { S3Service } from "@/lib/s3";

export function createR2S3Service(bucket = env.R2_BUCKET) {
  return new S3Service({
    endpoint: env.R2_ENDPOINT,
    bucket,
    accessKeyId: env.R2_ACCESS_KEY,
    secretAccessKey: env.R2_SECRET_KEY,
    region: env.R2_REGION || "auto",
    url: env.R2_URL_BASE,
  });
}

export function requirePrivateCompositionBucket(
  privateBucket: string | undefined,
  publicBucket: string,
) {
  if (!privateBucket || privateBucket === publicBucket) {
    throw new Error(
      "A dedicated private R2 bucket is required for composition results",
    );
  }
  return privateBucket;
}

export function createPrivateCompositionR2S3Service() {
  return createR2S3Service(
    requirePrivateCompositionBucket(env.R2_PRIVATE_BUCKET, env.R2_BUCKET),
  );
}

/**
 * Bucket used for new task outputs (persist / processed). Prefer the dedicated
 * private bucket when configured so objects are not anonymously reachable via
 * the public custom domain on `R2_BUCKET`.
 */
export function resolveTaskOutputBucket(
  privateBucket: string | undefined = env.R2_PRIVATE_BUCKET,
  publicBucket: string = env.R2_BUCKET,
): string {
  if (privateBucket && privateBucket !== publicBucket) return privateBucket;
  return publicBucket;
}

export function createTaskOutputR2S3Service() {
  return createR2S3Service(resolveTaskOutputBucket());
}

/**
 * Sign a GET for a task object key. When a dedicated private bucket is
 * configured, prefer it; callers that need historical public-bucket objects
 * should use `fetchTaskOutputByKey`, which falls back after a failed fetch.
 */
export async function getTaskOutputSignedUrl(
  key: string,
  expiresInSeconds = 60,
  bucket = resolveTaskOutputBucket(),
): Promise<string> {
  return createR2S3Service().getSignedUrl(key, bucket, expiresInSeconds);
}

/**
 * Return a working signed GET for an object key that may live on either the
 * private output bucket (new writes) or the legacy public bucket.
 */
export async function resolveTaskObjectSignedUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const privateBucket = env.R2_PRIVATE_BUCKET;
  const publicBucket = env.R2_BUCKET;
  const service = createR2S3Service();
  const buckets =
    privateBucket && privateBucket !== publicBucket
      ? [privateBucket, publicBucket]
      : [publicBucket];

  let fallback = "";
  for (const bucket of buckets) {
    const signedUrl = await service.getSignedUrl(key, bucket, expiresInSeconds);
    if (!fallback) fallback = signedUrl;
    try {
      const probe = await fetch(signedUrl, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (probe.ok || probe.status === 206) return signedUrl;
    } catch {
      // try next bucket
    }
  }
  return fallback || service.getSignedUrl(key, publicBucket, expiresInSeconds);
}

/**
 * Fetch object bytes for a locator key. Tries the private output bucket first
 * (new writes), then the legacy/public bucket (historical `s.remove-anything.com`
 * objects). Does not delete or rewrite historical public objects.
 */
export async function fetchTaskOutputByKey(
  key: string,
  expiresInSeconds = 60,
): Promise<Response> {
  const privateBucket = env.R2_PRIVATE_BUCKET;
  const publicBucket = env.R2_BUCKET;
  const service = createR2S3Service();
  const buckets =
    privateBucket && privateBucket !== publicBucket
      ? [privateBucket, publicBucket]
      : [publicBucket];

  let lastResponse: Response | null = null;
  for (const bucket of buckets) {
    const signedUrl = await service.getSignedUrl(key, bucket, expiresInSeconds);
    const response = await fetch(signedUrl, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) return response;
    lastResponse = response;
  }
  return lastResponse ?? new Response("File not found", { status: 404 });
}

/**
 * Retention deletes must cover both buckets: new outputs land in private, while
 * historical keys may still exist only on the public/custom-domain bucket.
 */
export function createRetentionR2Storage(): {
  deleteItemInBucket: (key: string) => Promise<void>;
} {
  const service = createR2S3Service();
  const privateBucket = env.R2_PRIVATE_BUCKET;
  const publicBucket = env.R2_BUCKET;
  const buckets =
    privateBucket && privateBucket !== publicBucket
      ? [privateBucket, publicBucket]
      : [publicBucket];

  return {
    async deleteItemInBucket(key: string) {
      let lastError: unknown;
      let deleted = false;
      for (const bucket of buckets) {
        try {
          await service.deleteItemInBucket(key, bucket);
          deleted = true;
        } catch (error) {
          lastError = error;
        }
      }
      if (!deleted && lastError) throw lastError;
    },
  };
}

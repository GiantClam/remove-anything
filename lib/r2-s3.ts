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

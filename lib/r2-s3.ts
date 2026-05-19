import { env } from "@/env.mjs";
import { S3Service } from "@/lib/s3";

export function createR2S3Service() {
  return new S3Service({
    endpoint: env.R2_ENDPOINT,
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY,
    secretAccessKey: env.R2_SECRET_KEY,
    region: env.R2_REGION || "auto",
    url: env.R2_URL_BASE,
  });
}

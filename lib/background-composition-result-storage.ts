import "server-only";

import { nanoid } from "nanoid";

import { env } from "@/env.mjs";
import {
  isBackgroundCompositionResultKey,
  makeBackgroundCompositionResultKey,
} from "@/lib/background-composition-result-key";
import {
  createPrivateCompositionR2S3Service,
  requirePrivateCompositionBucket,
} from "@/lib/r2-s3";

export class PrivateCompositionStorageError extends Error {
  readonly code = "PRIVATE_STORAGE_UNAVAILABLE";
  readonly status = 503;

  constructor() {
    super("Private composition storage is unavailable");
    this.name = "PrivateCompositionStorageError";
  }
}

export async function uploadBackgroundCompositionResult(
  compositionId: number,
  file: File,
): Promise<string> {
  if (file.type !== "image/png")
    throw new Error("Composition results must be PNG images");

  try {
    requirePrivateCompositionBucket(env.R2_PRIVATE_BUCKET, env.R2_BUCKET);
  } catch {
    throw new PrivateCompositionStorageError();
  }
  const key = makeBackgroundCompositionResultKey(compositionId, nanoid(21));
  const bytes = Buffer.from(await file.arrayBuffer());
  await createPrivateCompositionR2S3Service().putPrivateItemInBucket(
    key,
    bytes,
    "image/png",
  );
  return key;
}

export async function createBackgroundCompositionResultReadUrl(
  key: string,
  compositionId: number,
  expiresInSeconds = 60,
): Promise<string> {
  try {
    requirePrivateCompositionBucket(env.R2_PRIVATE_BUCKET, env.R2_BUCKET);
  } catch {
    throw new PrivateCompositionStorageError();
  }
  if (!isBackgroundCompositionResultKey(compositionId, key))
    throw new Error("Invalid composition result key");
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds < 1 ||
    expiresInSeconds > 60
  ) {
    throw new Error("Invalid composition result URL expiry");
  }
  return createPrivateCompositionR2S3Service().getSignedUrl(
    key,
    undefined,
    expiresInSeconds,
  );
}

export async function deleteBackgroundCompositionResult(
  key: string,
  compositionId: number,
): Promise<void> {
  try {
    requirePrivateCompositionBucket(env.R2_PRIVATE_BUCKET, env.R2_BUCKET);
  } catch {
    throw new PrivateCompositionStorageError();
  }
  if (!isBackgroundCompositionResultKey(compositionId, key))
    throw new Error("Invalid composition result key");
  await createPrivateCompositionR2S3Service().deleteItemInBucket(key);
}

import { nanoid } from "nanoid";

import { env } from "@/env.mjs";
import { createR2S3Service } from "@/lib/r2-s3";

function guessExtensionFromContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "png";
}

export function isR2PublicUrl(url?: string | null) {
  if (!url) {
    return false;
  }

  return url.startsWith(env.R2_URL_BASE);
}

export async function saveObjectRemovalImageToR2(
  imageUrl: string,
  taskId: string,
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download output image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const imageBuffer = await response.arrayBuffer();
  const ext = guessExtensionFromContentType(contentType);
  const storedFilename = `${taskId}-${nanoid(8)}.${ext}`;
  const key = `object-removal/processed/${storedFilename}`;

  const s3 = createR2S3Service();
  await s3.putItemInBucket(storedFilename, Buffer.from(imageBuffer), {
    path: "object-removal/processed",
    ContentType: contentType,
    acl: "public-read",
  });

  return `${env.R2_URL_BASE}/${key}`;
}

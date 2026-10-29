import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { env } from "@/env.mjs";
import { readLimitedResponse } from "@/lib/limited-response";
import { createR2S3Service } from "@/lib/r2-s3";

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
// Video results are larger than image results, but still bounded so a provider
// URL cannot make the callback path buffer an unbounded response.
const MAX_VIDEO_OUTPUT_BYTES = 100 * 1024 * 1024;

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const rawPath = value.match(/^https:\/\/[^/?#]+([^?#]*)/i)?.[1] || "/";
    const path = decodeURIComponent(rawPath);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.port ||
      isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
      url.hostname === "localhost" ||
      /\.(localhost|local)$/.test(url.hostname) ||
      /[\\\x00-\x20]/.test(value) ||
      /%(?:2f|5c|25)/i.test(rawPath) ||
      path.split("/").some((segment) => segment === "." || segment === "..") ||
      /(?:^|\/)\.{1,2}(?:\/|$)/.test(value.replace(/^https:\/\/[^/]+/i, ""))
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

/** The deployment owner must explicitly approve each provider origin AND path. */
export function isAllowedRunningHubOutput(
  value: string,
  prefixes = env.RUNNINGHUB_OUTPUT_URL_PREFIXES,
): boolean {
  const output = safeUrl(value);
  if (!output) return false;
  return (prefixes || "").split(",").some((entry) => {
    const prefix = safeUrl(entry.trim());
    if (!prefix || prefix.search || prefix.pathname === "/") return false;
    const path = `${prefix.pathname.replace(/\/$/, "")}/`;
    return output.origin === prefix.origin && output.pathname.startsWith(path);
  });
}

function imageType(
  bytes: Uint8Array,
): { mime: string; extension: string } | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    Buffer.from(bytes.subarray(1, 8)).equals(Buffer.from("PNG\r\n\x1a\n"))
  )
    return { mime: "image/png", extension: "png" };
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return { mime: "image/jpeg", extension: "jpg" };
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
  )
    return { mime: "image/webp", extension: "webp" };
  return null;
}

function videoType(
  bytes: Uint8Array,
): { mime: string; extension: string } | null {
  // WebM/Matroska files begin with the EBML header.
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return { mime: "video/webm", extension: "webm" };
  }

  // MP4/MOV files are ISO-BMFF containers with an `ftyp` box near the start.
  const prefix = Buffer.from(bytes.subarray(0, 64)).toString("ascii");
  if (prefix.includes("ftyp")) return { mime: "video/mp4", extension: "mp4" };
  return null;
}

/** Bounded migration for authenticated callbacks; never follow provider redirects. */
export async function persistRunningHubOutput(
  value: string,
  kind: "watermark" | "object" | "background" | "video",
  recordId: number,
): Promise<string> {
  if (!isAllowedRunningHubOutput(value))
    throw new Error("Provider output source is not approved");
  const maxBytes = kind === "video" ? MAX_VIDEO_OUTPUT_BYTES : MAX_OUTPUT_BYTES;
  const response = await fetch(value, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || response.status >= 300)
    throw new Error("Provider output could not be retrieved");
  let bytes = await readLimitedResponse(response, maxBytes);
  const detectedImage = imageType(bytes);
  const detectedVideo = kind === "video" ? videoType(bytes) : null;
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06));
  if (kind === "video") {
    if (!detectedVideo) throw new Error("Unsupported provider output format");
  } else if (!detectedImage && !(kind === "watermark" && isZip)) {
    throw new Error("Unsupported provider output format");
  }

  let contentType =
    detectedVideo?.mime || detectedImage?.mime || "application/zip";
  let extension = detectedVideo?.extension || detectedImage?.extension || "zip";
  if (kind === "watermark") {
    if (!isZip) {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file(`image_1.${extension}`, bytes, {
        date: new Date("1980-01-01T00:00:00.000Z"),
      });
      bytes = await zip.generateAsync({ type: "uint8array" });
      if (bytes.byteLength > maxBytes)
        throw new Error("Result exceeds the supported output size");
    }
    contentType = "application/zip";
    extension = "zip";
  }

  // Same callback content reuses the exact key, including concurrent delivery.
  const digest = createHash("sha256").update(bytes).digest("hex");
  const filename = `${recordId}-callback-${digest}.${extension}`;
  const path =
    kind === "object"
      ? "object-removal/processed"
      : kind === "background"
        ? "background-removal/processed"
        : kind === "video"
          ? "sora2-video-watermark-removal/processed"
          : "watermark-removal/processed";
  // Omit ACL headers: R2 buckets with object-ownership / private defaults reject canned ACLs.
  const key = `${path}/${filename}`;
  await createR2S3Service().putPrivateItemInBucket(
    key,
    Buffer.from(bytes),
    contentType,
  );
  return `${env.R2_URL_BASE.replace(/\/$/, "")}/${key}`;
}

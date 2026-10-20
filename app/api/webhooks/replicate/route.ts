import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env.mjs";
import {
  findBackgroundRemovalTaskByReplicateId,
  updateBackgroundRemovalTask,
} from "@/db/queries/background-removal";
import { readLimitedResponse, ResultSizeLimitError } from "@/lib/limited-response";
import { createR2S3Service } from "@/lib/r2-s3";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

const WebhookSchema = z.object({
  id: z.string().min(1).max(200),
  status: z.enum(["pending", "starting", "processing", "succeeded", "failed", "canceled"]),
  output: z.unknown().optional(),
  error: z.unknown().optional(),
  logs: z.unknown().optional(),
});

type ImageType = { mime: "image/png" | "image/jpeg" | "image/webp"; extension: "png" | "jpg" | "webp" };

function imageType(bytes: Uint8Array): ImageType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    Buffer.from(bytes.subarray(1, 8)).equals(Buffer.from("PNG\r\n\x1a\n"))
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

function safeHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const rawPath = value.match(/^https:\/\/[^/?#]+([^?#]*)/i)?.[1] || "/";
    const decodedPath = decodeURIComponent(rawPath);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
      url.hostname === "localhost" ||
      /\.(localhost|local)$/.test(url.hostname) ||
      /[\\\x00-\x20]/.test(value) ||
      /%(?:2f|5c|25)/i.test(rawPath) ||
      decodedPath.split("/").some((segment) => segment === "." || segment === "..")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isAllowedProviderOutput(value: string): boolean {
  const output = safeHttpsUrl(value);
  if (!output) return false;
  const prefixes = env.REPLICATE_OUTPUT_URL_PREFIXES || "";
  return prefixes.split(",").some((entry) => {
    const prefix = safeHttpsUrl(entry.trim());
    if (!prefix || prefix.search || prefix.pathname === "/") return false;
    const path = `${prefix.pathname.replace(/\/$/, "")}/`;
    return output.origin === prefix.origin && output.pathname.startsWith(path);
  });
}

function providerOutput(body: z.infer<typeof WebhookSchema>): string | null {
  if (typeof body.output === "string") return body.output;
  if (Array.isArray(body.output) && body.output.length === 1 && typeof body.output[0] === "string") {
    return body.output[0];
  }
  return null;
}

function webhookKey(secret: string): Buffer | null {
  if (!secret.startsWith("whsec_")) return null;
  const encoded = secret.slice("whsec_".length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const decoded = Buffer.from(encoded, "base64");
  if (
    decoded.length < 16 ||
    decoded.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")
  ) {
    return null;
  }
  return decoded;
}

function hasValidWebhookSignature(rawBody: Uint8Array, req: Request): boolean {
  const secret = env.REPLICATE_WEBHOOK_SECRET;
  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signatures = req.headers.get("webhook-signature");
  if (!secret || secret.length < 32 || !id || !timestamp || !signatures) return false;
  const key = webhookKey(secret);
  if (!key) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.`)
    .update(rawBody)
    .digest("base64");
  const expectedBytes = Buffer.from(expected);
  return signatures.split(" ").some((candidate) => {
    const match = /^v1,([A-Za-z0-9+/]+={0,2})$/.exec(candidate);
    if (!match) return false;
    const encoded = match[1];
    const actualBytes = Buffer.from(encoded);
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
  });
}

async function persistProviderOutput(source: string, taskRecordId: number): Promise<string> {
  if (!isAllowedProviderOutput(source)) throw new Error("Provider output source is not approved");
  const response = await fetch(source, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || response.status >= 300) throw new Error("Provider output could not be retrieved");
  const bytes = await readLimitedResponse(response, MAX_OUTPUT_BYTES);
  const detected = imageType(bytes);
  if (!detected) throw new Error("Unsupported provider output format");

  const digest = createHash("sha256").update(bytes).digest("hex");
  const filename = `${taskRecordId}-callback-${digest}.${detected.extension}`;
  const path = "background-removal/processed";
  const stored = await createR2S3Service().putItemInBucket(filename, Buffer.from(bytes), {
    path,
    ContentType: detected.mime,
    acl: "private",
  });
  return stored.completedUrl;
}

function errorText(error: unknown): string {
  if (typeof error === "string") return error.slice(0, 8_000);
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.slice(0, 8_000);
  }
  return "Task failed";
}

function logText(logs: unknown): string {
  if (typeof logs === "string") return logs.slice(0, 8_000);
  if (Array.isArray(logs)) return logs.filter((item) => typeof item === "string").join("\n").slice(0, 8_000);
  return "";
}

export async function POST(req: Request) {
  const secret = env.REPLICATE_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "Replicate callback authentication is unavailable" }, { status: 503 });
  }
  if (!req.headers.get("webhook-id") || !req.headers.get("webhook-timestamp") || !req.headers.get("webhook-signature")) {
    return NextResponse.json({ error: "Invalid callback signature" }, { status: 401 });
  }

  try {
    const bytes = await readLimitedResponse(new Response(req.body, { headers: req.headers }), MAX_BODY_BYTES);
    if (!hasValidWebhookSignature(bytes, req)) {
      return NextResponse.json({ error: "Invalid callback signature" }, { status: 401 });
    }

    let rawBody: string;
    try {
      rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
    }
    const body = WebhookSchema.parse(JSON.parse(rawBody));
    const taskRecord = await findBackgroundRemovalTaskByReplicateId(body.id);
    if (!taskRecord) return NextResponse.json({ message: "Task not found" }, { status: 200 });

    const updateData: Parameters<typeof updateBackgroundRemovalTask>[1] = {};
    if (body.status === "pending") {
      updateData.taskStatus = "pending";
    } else if (body.status === "starting") {
      updateData.taskStatus = "starting";
      updateData.executeStartTime = BigInt(Date.now());
    } else if (body.status === "processing") {
      updateData.taskStatus = "processing";
    } else if (body.status === "succeeded") {
      const source = providerOutput(body);
      if (!source || !isAllowedProviderOutput(source)) {
        return NextResponse.json({ error: "Provider result is not approved" }, { status: 503 });
      }
      // Persist the bytes before changing task state. A migration failure leaves
      // the task recoverable through polling and never stores a provider URL.
      const outputImageUrl = await persistProviderOutput(source, taskRecord.id);
      updateData.taskStatus = "succeeded";
      updateData.outputImageUrl = outputImageUrl;
      updateData.executeEndTime = BigInt(Date.now());
      updateData.errorMsg = logText(body.logs);
    } else {
      updateData.taskStatus = "failed";
      updateData.executeEndTime = BigInt(Date.now());
      updateData.errorMsg = errorText(body.error);
    }

    await updateBackgroundRemovalTask(body.id, updateData);
    return NextResponse.json({ message: "Webhook processed successfully", taskId: body.id, status: updateData.taskStatus }, { status: 200 });
  } catch (error) {
    if (error instanceof ResultSizeLimitError) {
      return NextResponse.json({ error: "Callback or output exceeds the supported size" }, { status: 413 });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
    }
    return NextResponse.json({ error: "Webhook could not be recorded; poll the original task" }, { status: 503 });
  }
}

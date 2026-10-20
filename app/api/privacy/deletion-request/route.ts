import { NextResponse, type NextRequest } from "next/server";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "@/env.mjs";
import { resend } from "@/lib/email";
import { kv, KVRateLimit } from "@/lib/kv";

export const dynamic = "force-dynamic";

const RequestSchema = z
  .object({
    email: z.string().trim().email().max(254),
    taskType: z.enum(["image", "background", "object", "watermark", "video"]),
    taskId: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[\w-]+$/),
    details: z.string().trim().max(500).optional().default(""),
    website: z.string().max(200).optional().default(""),
  })
  .strict();

const rateLimit = new KVRateLimit(kv, { limit: 3, window: "1h" });

function requesterKey(req: NextRequest) {
  const address =
    req.ip ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return createHash("sha256").update(address).digest("hex").slice(0, 24);
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") || 0) > 8_192) {
    return NextResponse.json(
      { error: "Request is too large" },
      { status: 413 },
    );
  }

  const limit = await rateLimit.limit(`deletion-request:${requesterKey(req)}`);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ success: true, requestId: "received" });
  }

  const to = env.SITE_NOTIFICATION_EMAIL_TO;
  const from = env.NEXT_PUBLIC_SITE_EMAIL_FROM;
  if (
    !to ||
    !from ||
    env.RESEND_API_KEY === "re_placeholder" ||
    from.endsWith("@localhost")
  ) {
    return NextResponse.json(
      { error: "Request intake is temporarily unavailable" },
      { status: 503 },
    );
  }

  const requestId = randomUUID();
  const { email, taskType, taskId, details } = parsed.data;
  try {
    const result = await resend.emails.send({
      from,
      to,
      reply_to: email,
      subject: `Early deletion request ${requestId}`,
      text: [
        `Request ID: ${requestId}`,
        `Task type: ${taskType}`,
        `Task ID: ${taskId}`,
        `Requester email: ${email}`,
        "Action: verify requester ownership, then review the early deletion request.",
        "No data was deleted by this request endpoint.",
        details ? `Additional details: ${details}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    if (result.error) throw new Error("Email delivery failed");
  } catch {
    return NextResponse.json(
      { error: "Request intake is temporarily unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.json({ success: true, requestId }, { status: 202 });
}

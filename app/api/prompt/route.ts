import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth-utils";

import { z } from "zod";

import { env } from "@/env.mjs";
import { getErrorMessage } from "@/lib/handle-error";
import { kv, KVRateLimit } from "@/lib/kv";
import { aiGateway } from "@/lib/ai-gateway";

const CreatePromptSchema = z.object({
  prompt: z.string(),
});

// 使用 AI Gateway 调用 Gemini，无需单独的客户端

const ratelimit = new KVRateLimit(kv, {
  limit: 2,
  window: "5s"
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.id;

  const { success } = await ratelimit.limit(
    "get-prompt:redeemed" + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const data = await req.json();
    const { prompt } = CreatePromptSchema.parse(data);
    
    // 使用 AI Gateway 调用 Gemini
    const response = await aiGateway.generateTextViaGemini({
      messages: [
        {
          role: "system",
          content: env.FLUX_AI_PROMPT,
        },
        { role: "user", content: prompt },
      ],
      model: env.GEMINI_MODEL,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return NextResponse.json(
      {
        prompt: response.choices?.[0]?.message?.content ?? "",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}

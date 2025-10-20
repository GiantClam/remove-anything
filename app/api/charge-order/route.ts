import { NextResponse, type NextRequest } from "next/server";

import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { z } from "zod";

import { ChargeOrderHashids } from "@/db/dto/charge-order.dto";
import { ChargeProductHashids } from "@/db/dto/charge-product.dto";
import { prisma } from "@/db/prisma";
import { OrderPhase } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";
import { kv } from "@/lib/kv";
import { createStripeClient } from "@/modules/payments/stripe/adapter";
import { absoluteUrl } from "@/lib/utils";

// 为这个 API 创建自定义速率限制器
import { KVRateLimit } from "@/lib/kv";

const CreateChargeOrderSchema = z.object({
  currency: z.enum(["CNY", "USD"]).default("USD"),
  productId: z.string(),
  amount: z.number().min(100).max(1000000000),
  channel: z.enum(["GiftCode", "Stripe"]).default("Stripe"),
  url: z.string().optional(),
});

const ratelimit = new KVRateLimit(kv, {
  limit: 2,
  window: "5s"
});

export async function POST(req: NextRequest) {
  const auth = createProjectAuthProvider();
  const user = await auth.getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.userId!;

  const { success } = await ratelimit.limit(
    "charge-order:created" + `_${req.ip ?? ""}`,
  );
  if (!success) {
    return new Response("Too Many Requests", {
      status: 429,
    });
  }

  try {
    const data = await req.json();
    const { currency, amount, channel, productId, url } =
      CreateChargeOrderSchema.parse(data);
    if (channel !== "Stripe") {
      return NextResponse.json(
        { error: "Not Support Channel" },
        { status: 400 },
      );
    }
    const [chargeProductId] = ChargeProductHashids.decode(productId);
    const product = await prisma.chargeProduct.findFirst({
      where: {
        id: chargeProductId as number,
      },
    });
    if (!product) {
      return NextResponse.json(
        { error: "product not exists" },
        { status: 404 },
      );
    }
    const newChargeOrder = await prisma.chargeOrder.create({
      data: {
        userId: userId,
        userInfo: JSON.stringify({
          fullName: user.name,
          email: user.email,
          username: user.email,
        }),
        currency,
        credit: product.credit,
        amount,
        channel,
        phase: OrderPhase.Pending,
      },
    });

    const orderId = ChargeOrderHashids.encode(newChargeOrder.id);
    const billingUrl = absoluteUrl(`/pricing?orderId=${orderId}`);
    const nextUrl = url?.includes("?")
      ? `${url}&orderId=${orderId}`
      : `${url}?orderId=${orderId}`;
    if (channel === "Stripe") {
      const stripeClient = createStripeClient();
      const session = await stripeClient.createCheckoutSession({
        priceId: '', // 使用 price_data 自定义金额时可留空
        quantity: 1,
        successUrl: `${nextUrl ?? billingUrl}&success=true`,
        cancelUrl: `${nextUrl ?? billingUrl}&success=false`,
        customerEmail: user.email || undefined,
        metadata: { orderId, userId: userId, chargeProductId: productId },
      });
      // 回退：保留旧逻辑的自定义金额，直接用 url 跳转（session.url 已在适配器处理）
      return NextResponse.json({ orderId, url: session.url as string });
    }
    return NextResponse.json({
      orderId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}

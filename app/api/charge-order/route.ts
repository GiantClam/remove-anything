import { NextResponse, type NextRequest } from "next/server";

import { z } from "zod";

import { ChargeOrderHashids } from "@/db/dto/charge-order.dto";
import { ChargeProductHashids } from "@/db/dto/charge-product.dto";
import { prisma } from "@/db/prisma";
import { OrderPhase } from "@/db/type";
import {
  ANALYTICS_EVENTS,
  createOrderAnalyticsEvent,
  emitServerAnalyticsEvent,
} from "@/lib/analytics-events";
import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { getErrorMessage } from "@/lib/handle-error";
// 为这个 API 创建自定义速率限制器
import { kv, KVRateLimit } from "@/lib/kv";
import { absoluteUrl } from "@/lib/utils";
import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { createStripeClient } from "@/modules/payments/stripe/adapter";

const CreateChargeOrderSchema = z.object({
  currency: z.enum(["CNY", "USD"]).default("USD"),
  productId: z.string(),
  amount: z.number().min(100).max(1000000000).optional(),
  channel: z.enum(["GiftCode", "Stripe"]).default("Stripe"),
  url: z.string().optional(),
});

const ratelimit = new KVRateLimit(kv, {
  limit: 2,
  window: "5s",
});

// 包装函数以匹配适配器期望的类型
const getCurrentUser = async () => {
  const user = await getCurrentUserOriginal();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  };
};

function appendQueryParams(baseUrl: string, params: Record<string, string>) {
  const nextUrl = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    nextUrl.searchParams.set(key, value);
  }

  return nextUrl.toString();
}

export async function POST(req: NextRequest) {
  const auth = createProjectAuthProvider(getCurrentUser);
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
    const { currency, channel, productId, url } =
      CreateChargeOrderSchema.parse(data);
    if (channel === "GiftCode") {
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
        amount: product.amount,
        channel,
        phase: OrderPhase.Pending,
      },
    });

    const orderId = ChargeOrderHashids.encode(newChargeOrder.id);
    try {
      await emitServerAnalyticsEvent(
        createOrderAnalyticsEvent(ANALYTICS_EVENTS.orderCreated, orderId, {
          plan: productId,
          amount: product.amount,
          currency,
          is_authenticated: true,
        }),
      );
    } catch (analyticsError) {
      // Measurement delivery must not strand a newly-created pending order.
      console.warn("Order creation analytics failed:", analyticsError);
    }
    const fallbackBillingUrl = absoluteUrl(`/pricing?orderId=${orderId}`);
    const originUrl = url || fallbackBillingUrl;
    const pricingUrl = appendQueryParams(originUrl, { orderId });

    if (channel === "Stripe") {
      const stripeClient = createStripeClient();
      const session = await stripeClient.createCheckoutSession({
        priceId: "",
        quantity: 1,
        successUrl: appendQueryParams(pricingUrl, { success: "true" }),
        cancelUrl: appendQueryParams(pricingUrl, { success: "false" }),
        customerEmail: user.email || undefined,
        metadata: { orderId, userId: userId, chargeProductId: productId },
        unitAmount: product.amount,
        currency,
        productName: product.title,
      });
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

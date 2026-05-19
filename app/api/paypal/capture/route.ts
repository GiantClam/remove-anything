import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { ChargeOrderHashids } from "@/db/dto/charge-order.dto";
import { prisma } from "@/db/prisma";
import { OrderPhase, PaymentChannelType } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";
import { fulfillChargeOrderPayment } from "@/modules/payments/charge-order";
import { createPayPalClient } from "@/modules/payments/paypal/adapter";
import type { PayPalCaptureResult } from "@/modules/payments/paypal/sdk";

const CapturePayPalOrderSchema = z.object({
  orderId: z.string().min(1),
  token: z.string().min(1),
});

const getCurrentUser = async () => {
  const user = await getCurrentUserOriginal();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  };
};

function parseChargeOrderResult(result: string | null) {
  if (!result) {
    return {};
  }

  try {
    return JSON.parse(result) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const auth = createProjectAuthProvider(getCurrentUser);
  const user = await auth.getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { orderId, token } = CapturePayPalOrderSchema.parse(await req.json());
    const [decodedOrderId] = ChargeOrderHashids.decode(orderId);

    const chargeOrder = await prisma.chargeOrder.findFirst({
      where: {
        id: decodedOrderId as number,
        userId: user.userId,
        channel: PaymentChannelType.PayPal,
      },
    });

    if (!chargeOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (chargeOrder.phase === OrderPhase.Paid) {
      return NextResponse.json({
        success: true,
        orderId,
        channel: PaymentChannelType.PayPal,
      });
    }

    if (chargeOrder.phase !== OrderPhase.Pending) {
      return NextResponse.json(
        { error: `Order is not payable: ${chargeOrder.phase}` },
        { status: 400 },
      );
    }

    const existingResult = parseChargeOrderResult(chargeOrder.result);
    const existingPayPalOrderId =
      typeof existingResult.paypalOrderId === "string"
        ? existingResult.paypalOrderId
        : undefined;

    if (existingPayPalOrderId && existingPayPalOrderId !== token) {
      await prisma.chargeOrder.update({
        where: { id: chargeOrder.id },
        data: {
          phase: OrderPhase.Failed,
          result: JSON.stringify({
            ...existingResult,
            captureError: "PayPal order token mismatch",
          }),
        },
      });

      return NextResponse.json(
        { error: "PayPal order token mismatch" },
        { status: 400 },
      );
    }

    const paypalClient = createPayPalClient();
    let captureResult: PayPalCaptureResult;
    try {
      captureResult = await paypalClient.captureOrder({
        paypalOrderId: token,
        requestId: `charge-order-capture-${chargeOrder.id}`,
      });
    } catch (error) {
      await prisma.chargeOrder.update({
        where: { id: chargeOrder.id },
        data: {
          phase: OrderPhase.Failed,
          result: JSON.stringify({
            ...existingResult,
            captureError: getErrorMessage(error),
          }),
        },
      });

      throw error;
    }

    const expectedAmount = (chargeOrder.amount / 100).toFixed(2);
    const capturedAmount = captureResult.amount?.value;
    const capturedCurrency = captureResult.amount?.currency_code;

    if (
      captureResult.status !== "COMPLETED" ||
      capturedAmount !== expectedAmount ||
      capturedCurrency !== chargeOrder.currency
    ) {
      await prisma.chargeOrder.update({
        where: { id: chargeOrder.id },
        data: {
          phase: OrderPhase.Failed,
          result: JSON.stringify({
            ...existingResult,
            captureId: captureResult.captureId ?? null,
            captureStatus: captureResult.status,
            rawCaptureOrder: captureResult.raw,
            captureError: "PayPal capture verification failed",
          }),
        },
      });

      return NextResponse.json(
        { error: "PayPal capture verification failed" },
        { status: 400 },
      );
    }

    const mergedResult = JSON.stringify({
      ...existingResult,
      provider: "paypal",
      paypalOrderId: captureResult.id,
      captureId: captureResult.captureId ?? null,
      captureStatus: captureResult.status,
      rawCaptureOrder: captureResult.raw,
    });

    await prisma.$transaction(async (tx) => {
      await fulfillChargeOrderPayment(tx, {
        chargeOrderId: chargeOrder.id,
        userId: user.userId!,
        result: mergedResult,
      });
    });

    return NextResponse.json({
      success: true,
      orderId,
      channel: PaymentChannelType.PayPal,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}

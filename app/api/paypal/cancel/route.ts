import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createProjectAuthProvider } from "@/modules/auth/adapter";
import { getCurrentUser as getCurrentUserOriginal } from "@/lib/auth-utils";
import { ChargeOrderHashids } from "@/db/dto/charge-order.dto";
import { prisma } from "@/db/prisma";
import { OrderPhase, PaymentChannelType } from "@/db/type";
import { getErrorMessage } from "@/lib/handle-error";

const CancelPayPalOrderSchema = z.object({
  orderId: z.string().min(1),
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
    const { orderId } = CancelPayPalOrderSchema.parse(await req.json());
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

    if (chargeOrder.phase === OrderPhase.Canceled) {
      return NextResponse.json({ success: true, orderId });
    }

    if (chargeOrder.phase === OrderPhase.Paid) {
      return NextResponse.json(
        { error: "Paid order cannot be canceled" },
        { status: 400 },
      );
    }

    const result = parseChargeOrderResult(chargeOrder.result);
    await prisma.chargeOrder.update({
      where: { id: chargeOrder.id },
      data: {
        phase: OrderPhase.Canceled,
        result: JSON.stringify({
          ...result,
          canceledAt: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}

import { Prisma } from "@prisma/client";

import { OrderPhase } from "@/db/type";

type ChargeOrderTransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function fulfillChargeOrderPayment(
  tx: ChargeOrderTransactionClient,
  params: {
    chargeOrderId: number;
    userId: string;
    result?: string | null;
  },
) {
  const order = await tx.chargeOrder.findFirst({
    where: {
      id: params.chargeOrderId,
      userId: params.userId,
    },
  });

  if (!order) {
    throw new Error("Charge order not found");
  }

  if (order.phase === OrderPhase.Paid) {
    return { alreadyPaid: true, order };
  }

  if (order.phase !== OrderPhase.Pending) {
    throw new Error(`Charge order is not payable: ${order.phase}`);
  }

  const updated = await tx.chargeOrder.updateMany({
    where: {
      id: order.id,
      phase: OrderPhase.Pending,
    },
    data: {
      phase: OrderPhase.Paid,
      paymentAt: new Date(),
      ...(params.result !== undefined ? { result: params.result } : {}),
    },
  });

  if (updated.count === 0) {
    const latestOrder = await tx.chargeOrder.findUnique({
      where: { id: order.id },
    });

    if (latestOrder?.phase === OrderPhase.Paid) {
      return { alreadyPaid: true, order: latestOrder };
    }

    throw new Error("Charge order payment transition failed");
  }

  const existingCredit = await tx.userCredit.findFirst({
    where: { userId: params.userId },
  });

  const updatedCredit = existingCredit
    ? await tx.userCredit.update({
        where: { id: existingCredit.id },
        data: {
          credit: {
            increment: order.credit,
          },
        },
      })
    : await tx.userCredit.create({
        data: {
          userId: params.userId,
          credit: order.credit,
        },
      });

  await tx.userCreditTransaction.create({
    data: {
      userId: params.userId,
      credit: order.credit,
      balance: updatedCredit.credit,
      type: "Charge",
      billingId: order.id,
    },
  });

  return {
    alreadyPaid: false,
    order: {
      ...order,
      phase: OrderPhase.Paid,
      paymentAt: new Date(),
      result: params.result ?? order.result,
    },
  };
}

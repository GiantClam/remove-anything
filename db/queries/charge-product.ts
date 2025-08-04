import { ChargeProductHashids } from "@/db/dto/charge-product.dto";
import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery, getBuildTimeFallback } from "@/lib/build-check";

import {
  OrderPhase,
  PaymentChannelType,
  type ChargeProductSelectDto,
} from "../type";

export async function getChargeProduct(locale?: string) {
  // 在构建时或没有数据库连接时返回默认值
  if (shouldSkipDatabaseQuery()) {
    // 返回默认的套餐数据用于构建时
    const defaultProducts: ChargeProductSelectDto[] = [
      {
        id: "build-starter-123",
        amount: 500,
        originalAmount: 600,
        credit: 150,
        currency: "USD",
        locale: locale || "en",
        title: locale === "zh" ? "入门版" : "Starter",
        tag: locale === "zh" ? "热门" : "Popular",
        message: locale === "zh" ? "150积分,基础模型,标准支持" : "150 credits,Basic models,Standard support",
        state: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "build-pro-456",
        amount: 2000,
        originalAmount: 2400,
        credit: 600,
        currency: "USD",
        locale: locale || "en",
        title: locale === "zh" ? "专业版" : "Pro",
        tag: locale === "zh" ? "超值" : "Best Value",
        message: locale === "zh" ? "600积分,所有模型,优先支持,商业许可" : "600 credits,All models,Priority support,Commercial license",
        state: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "build-business-789",
        amount: 5000,
        originalAmount: 6000,
        credit: 1500,
        currency: "USD",
        locale: locale || "en",
        title: locale === "zh" ? "企业版" : "Business",
        tag: locale === "zh" ? "企业级" : "Enterprise",
        message: locale === "zh" ? "1500积分,所有模型,优先支持,商业许可,API访问" : "1500 credits,All models,Priority support,Commercial license,API access",
        state: "active",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    return getBuildTimeFallback({
      data: defaultProducts,
    });
  }

  const data = await prisma.chargeProduct.findMany({
    where: {
      locale,
    },
    orderBy: {
      credit: "asc",
    },
  });

  return {
    data: (data.map(({ id, ...rest }) => ({
      ...rest,
      id: ChargeProductHashids.encode(id),
    })) ?? []) as ChargeProductSelectDto[],
  };
}
const activityCode = "NEW_REGISTER_ACTIVITY";

export async function getClaimed(userId: string) {
  const targetDate = new Date("2024-08-20T20:20:00+08:00");
  const oneMonthLater = new Date(
    targetDate.getTime() + 30 * 24 * 60 * 60 * 1000,
  );
  // Step 1: Get the IDs of claimed orders for the user
  const claimedOrderIds = await prisma.claimedActivityOrder.findMany({
    where: {
      activityCode,
      userId,
    },
    select: {
      id: true,
      chargeOrderId: true,
    },
  });
  const claimedChargeOrderIdIds = claimedOrderIds.map((row) => row.chargeOrderId);
  const charOrders = await prisma.chargeOrder.findMany({
    where: {
      phase: OrderPhase.Paid,
      userId,
      channel: PaymentChannelType.Stripe,
      paymentAt: {
        gte: targetDate,
        lte: oneMonthLater,
      },
      id: {
        notIn: claimedChargeOrderIdIds,
      },
    },
  });
  return charOrders.length > 0;
}

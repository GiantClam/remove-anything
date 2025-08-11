import { ChargeProductHashids } from "@/db/dto/charge-product.dto";
import { prisma } from "@/db/prisma";
import { shouldSkipDatabaseQuery, getBuildTimeFallback } from "@/lib/build-check";

import {
  OrderPhase,
  PaymentChannelType,
  type ChargeProductSelectDto,
} from "../type";

// 默认产品数据，用于构建时和错误时的回退
const getDefaultProducts = (locale?: string): ChargeProductSelectDto[] => [
  {
    id: "fallback-starter-123",
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
    id: "fallback-pro-456",
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
    id: "fallback-business-789",
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

export async function getChargeProduct(locale?: string) {
  // 在构建时或没有数据库连接时返回默认值
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过 getChargeProduct 数据库查询，返回默认值");
    return getBuildTimeFallback({
      data: getDefaultProducts(locale),
    });
  }

  // 添加重试机制
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 getChargeProduct 尝试 ${attempt}/${maxRetries}`);
      
      // 对于prepared statement错误，先尝试重新连接
      if (attempt > 1 && lastError?.message?.includes('prepared statement')) {
        console.log("🔄 检测到prepared statement错误，重新连接数据库...");
        try {
          await prisma.$disconnect();
          // 等待一下确保连接完全断开
          await new Promise(resolve => setTimeout(resolve, 100));
          await prisma.$connect();
        } catch (reconnectError) {
          console.error("重连失败:", reconnectError);
        }
      }
      
      const data = await prisma.chargeProduct.findMany({
        where: {
          locale,
        },
        orderBy: {
          credit: "asc",
        },
      });

      console.log(`✅ getChargeProduct 查询成功，获取到 ${data.length} 条记录`);
      
      return {
        data: (data.map(({ id, ...rest }) => ({
          ...rest,
          id: ChargeProductHashids.encode(id),
        })) ?? []) as ChargeProductSelectDto[],
      };
    } catch (error) {
      lastError = error;
      console.error(`❌ getChargeProduct 第 ${attempt} 次尝试失败:`, error);
      
      // 如果是连接错误，等待后重试
      if (attempt < maxRetries && (
        error?.message?.includes('prepared statement') ||
        error?.message?.includes('connection') ||
        error?.message?.includes('timeout')
      )) {
        const delay = Math.pow(2, attempt) * 1000; // 指数退避
        console.log(`⏳ 等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 最后一次尝试失败，跳出循环
      break;
    }
  }

  // 所有重试都失败了，返回默认值
  console.error("❌ getChargeProduct 所有重试都失败，返回默认值:", lastError);
  
  return {
    data: getDefaultProducts(locale),
  };
}
const activityCode = "NEW_REGISTER_ACTIVITY";

export async function getClaimed(userId: string) {
  // 在构建时或没有数据库连接时返回默认值
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过 getClaimed 数据库查询，返回 false");
    return false;
  }

  try {
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
  } catch (error) {
    console.error("❌ getClaimed 数据库查询错误:", error);
    return false;
  }
}

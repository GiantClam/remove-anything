import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery, getBuildTimeFallback } from "@/lib/build-check";
import { logsnag } from "@/lib/log-snag";

export async function getUserCredit(userId: string) {
  // 在构建时或没有数据库连接时返回默认值
  if (shouldSkipDatabaseQuery()) {
    return getBuildTimeFallback({
      id: "build-credit-123",
      userId: userId,
      credit: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 开发模式：为测试用户提供无限信用
  const isDevMode = env.GOOGLE_CLIENT_ID === "google-client-id-placeholder" || 
                    env.GOOGLE_CLIENT_SECRET === "google-client-secret-placeholder";
  
  if (isDevMode && process.env.NODE_ENV === "development" && userId === "dev-user-123") {
    console.log("🔧 开发模式：为测试用户提供 1000 信用额度");
    return {
      id: "dev-credit-123",
      userId: "dev-user-123",
      credit: 1000, // 开发模式提供充足的信用额度
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  
  let accountInfo = await prisma.userCredit.findFirst({
    where: {
      userId,
    },
  });
  if (!accountInfo?.id) {
    // 新用户注册赠送100积分
    const signupBonus = 100;
    
    const data = await prisma.$transaction(async (tx) => {
      // 创建用户积分记录
      const userCredit = await tx.userCredit.create({
        data: {
          userId: userId,
          credit: signupBonus,
        },
      });

      // 创建计费记录
      const billing = await tx.userBilling.create({
        data: {
          userId: userId,
          state: "Done",
          amount: signupBonus,
          type: "Gift", // 使用Gift类型表示赠送
          description: "New User Signup Bonus - 100 Credits",
        },
      });

      // 创建积分交易记录
      await tx.userCreditTransaction.create({
        data: {
          userId: userId,
          credit: signupBonus,
          balance: signupBonus,
          billingId: billing.id,
          type: "Signup Bonus",
        },
      });

      console.log(`🎉 新用户 ${userId} 注册成功，赠送 ${signupBonus} 积分`);
      
      // 发送通知到LogSnag
      try {
        await logsnag.track({
          channel: "signup",
          event: "New User Signup",
          user_id: userId,
          description: `新用户注册并获得 ${signupBonus} 积分奖励`,
          icon: "🎉",
          tags: {
            credits: signupBonus.toString(),
            source: "signup_bonus"
          }
        });
      } catch (error) {
        console.error("❌ LogSnag通知发送失败:", error);
      }
      
      return userCredit;
    });
    
    accountInfo = data;
  }
  return accountInfo;
}

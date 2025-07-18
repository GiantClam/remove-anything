import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";

export async function getUserCredit(userId: string) {
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
    const data = await prisma.userCredit.create({
      data: {
        userId: userId,
        credit: 0,
      },
    });
    accountInfo = data;
  }
  return accountInfo;
}

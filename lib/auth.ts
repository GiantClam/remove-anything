import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/db/prisma";
import { env } from "@/env.mjs";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";
import { logsnag } from "@/lib/log-snag";

// 条件性配置
const providers: any[] = [];

// 只在Google OAuth配置存在时添加Google Provider
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  // 只在数据库URL存在且不在构建时且prisma客户端可用时使用Prisma适配器
  ...(env.DATABASE_URL && !shouldSkipDatabaseQuery() && prisma && typeof prisma === 'object' && Object.keys(prisma).length > 0 && {
    adapter: PrismaAdapter(prisma) as any,
  }),
  providers,
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
    jwt: async ({ user, token }) => {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
    signIn: async ({ user, account, profile }) => {
      console.log("🔐 登录回调:", { 
        user: user?.email, 
        provider: account?.provider,
        hasProfile: !!profile 
      });
      return true;
    },
  },
  // 在用户注册立即初始化积分（而非首次查询）
  events: {
    createUser: async ({ user }) => {
      try {
        if (!env.DATABASE_URL || shouldSkipDatabaseQuery()) return;
        if (!user?.id) return;

        const signupBonus = 10;

        // 如果已有积分记录则跳过
        const exists = await prisma.userCredit.findFirst({
          where: { userId: user.id },
          select: { id: true },
        });
        if (exists?.id) return;

        await prisma.$transaction(async (tx) => {
          const userCredit = await tx.userCredit.create({
            data: {
              userId: user.id,
              credit: signupBonus,
            },
          });

          const billing = await tx.userBilling.create({
            data: {
              userId: user.id,
              state: "Done",
              amount: signupBonus,
              type: "Gift",
              description: `New User Signup Bonus - ${signupBonus} Credits`,
            },
          });

          await tx.userCreditTransaction.create({
            data: {
              userId: user.id,
              credit: signupBonus,
              balance: signupBonus,
              billingId: billing.id,
              type: "Signup Bonus",
            },
          });

          console.log(`🎉 新用户 ${user.id} 注册成功，赠送 ${signupBonus} 积分`);
        });

        // 发送通知（非关键路径，失败忽略）
        try {
          await logsnag.track({
            channel: "signup",
            event: "New User Signup",
            user_id: user.id,
            description: `新用户注册并获得 ${signupBonus} 积分奖励`,
            icon: "🎉",
            tags: {
              credits: String(signupBonus),
              source: "signup_bonus",
            },
          });
        } catch (err) {
          console.error("❌ LogSnag通知发送失败:", err);
        }
      } catch (error) {
        console.error("❌ createUser 初始化积分失败:", error);
      }
    },
  },
  pages: {
    signIn: "/signin",
    signOut: "/signout", 
    error: "/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  ...(env.NEXTAUTH_SECRET && { secret: env.NEXTAUTH_SECRET }),
}; 
import { PrismaClient } from "@prisma/client";

import "server-only";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

declare global {
  // eslint-disable-next-line no-var
  var cachedPrisma: PrismaClient;
}

export let prisma: PrismaClient;

// 检查是否在构建时
const isBuildTime = shouldSkipDatabaseQuery();

if (isBuildTime) {
  // 在构建时创建一个虚拟的Prisma客户端，避免构建时数据库连接
  prisma = {
    $connect: async () => {
      console.log("🔧 构建时：跳过Prisma连接");
    },
    $disconnect: async () => {
      console.log("🔧 构建时：跳过Prisma断开连接");
    },
    // 添加其他可能被调用的方法
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async () => ({} as any),
    update: async () => ({} as any),
    delete: async () => ({} as any),
    count: async () => 0,
    // 添加BackgroundRemovalTask模型
    backgroundRemovalTask: {
      findFirst: async () => null,
      findUnique: async () => null,
      create: async () => ({} as any),
      update: async () => ({} as any),
      delete: async () => ({} as any),
      findMany: async () => [],
      count: async () => 0,
    },
  } as any;
  console.log("🔧 构建时：创建虚拟Prisma客户端");
} else {
  // 在运行时创建真实的Prisma客户端
  if (process.env.NODE_ENV === "production") {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // 添加连接池配置和错误处理
      log: ['error', 'warn'],
    });
  } else {
    if (!global.cachedPrisma) {
      global.cachedPrisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
        // 添加连接池配置和错误处理
        log: ['error', 'warn'],
      });
    }
    prisma = global.cachedPrisma;
  }
  console.log("✅ 运行时：创建真实Prisma客户端");
  
  // 只在运行时尝试连接数据库
  prisma.$connect()
    .then(() => {
      console.log("✅ Prisma数据库连接成功");
    })
    .catch((error) => {
      console.error("❌ Prisma数据库连接失败:", error);
    });
}

// 优雅关闭连接
process.on('beforeExit', async () => {
  if (!isBuildTime) {
    await prisma.$disconnect();
  }
});

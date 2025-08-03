import { PrismaClient } from "@prisma/client";

import "server-only";

declare global {
  // eslint-disable-next-line no-var
  var cachedPrisma: PrismaClient;
}

// 构建时检查函数
function shouldSkipDatabaseQuery(): boolean {
  return process.env.VERCEL === "1" || 
         (process.env.NODE_ENV === "production" && process.env.SKIP_DB_BUILD === "1");
}

export let prisma: PrismaClient;

// 在构建时跳过Prisma初始化
if (shouldSkipDatabaseQuery()) {
  // 创建一个虚拟的Prisma客户端，避免构建时数据库连接
  prisma = {} as PrismaClient;
  console.log("🔧 构建时：跳过Prisma客户端初始化");
} else if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClient();
  }
  prisma = global.cachedPrisma;
}

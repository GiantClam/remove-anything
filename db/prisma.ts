import { PrismaClient } from "@prisma/client";

import "server-only";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

declare global {
  // eslint-disable-next-line no-var
  var cachedPrisma: PrismaClient;
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

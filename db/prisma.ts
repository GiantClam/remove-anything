import { PrismaClient } from "@prisma/client";

import "server-only";
import { shouldSkipDatabaseQuery } from "@/lib/build-check";

declare global {
  // eslint-disable-next-line no-var
  var cachedPrisma: PrismaClient;
  // eslint-disable-next-line no-var
  var cachedPrismaConnectPromise: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var prismaBeforeExitRegistered: boolean | undefined;
}

export let prisma: PrismaClient;

function resolveDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    const isSupabasePooler =
      parsed.hostname.includes("pooler.supabase.com") &&
      parsed.port === "6543";

    if (isSupabasePooler) {
      if (!parsed.searchParams.has("pgbouncer")) {
        parsed.searchParams.set("pgbouncer", "true");
      }

      if (!parsed.searchParams.has("connection_limit")) {
        parsed.searchParams.set("connection_limit", "1");
      }
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

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
    // 添加WatermarkRemovalTask模型
    watermarkRemovalTask: {
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
  let createdNewClient = false;
  if (process.env.NODE_ENV === "production") {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: resolveDatabaseUrl(),
        },
      },
      // 添加连接池配置和错误处理
      log: ['error', 'warn'],
    });
    createdNewClient = true;
  } else {
    if (!global.cachedPrisma) {
      global.cachedPrisma = new PrismaClient({
        datasources: {
          db: {
            url: resolveDatabaseUrl(),
          },
        },
        // 添加连接池配置和错误处理
        log: ['error', 'warn'],
      });
      createdNewClient = true;
    }
    prisma = global.cachedPrisma;
  }

  if (createdNewClient) {
    console.log("✅ 运行时：创建真实Prisma客户端");
  }

  // 只在首次创建时尝试连接数据库，避免开发模式下模块重复求值造成噪音
  if (process.env.NODE_ENV === "production") {
    prisma.$connect().catch((error) => {
      console.error("❌ Prisma数据库连接失败:", error);
    });
  } else if (!global.cachedPrismaConnectPromise) {
    global.cachedPrismaConnectPromise = prisma.$connect()
      .then(() => {
        console.log("✅ Prisma数据库连接成功");
      })
      .catch((error) => {
        console.error("❌ Prisma数据库连接失败:", error);
        global.cachedPrismaConnectPromise = undefined;
      });
  }
}

// 优雅关闭连接
if (!isBuildTime && !global.prismaBeforeExitRegistered) {
  global.prismaBeforeExitRegistered = true;
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

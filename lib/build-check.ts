/**
 * 构建时检查工具
 * 用于在Vercel构建时避免数据库查询
 */

export function isBuildTime(): boolean {
  return process.env.NODE_ENV === "production" && !process.env.DATABASE_URL;
}

export function isVercelBuild(): boolean {
  return process.env.VERCEL === "1" && process.env.NODE_ENV === "production";
}

export function shouldSkipDatabaseQuery(): boolean {
  // 只有在构建阶段才跳过数据库查询
  // VERCEL_ENV只有在运行时才会被设置（preview, production等）
  // 构建时VERCEL_ENV是undefined
  if (process.env.VERCEL === "1" && process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV) {
    console.log("🔧 Vercel构建阶段：跳过数据库查询");
    return true;
  }
  
  // 如果设置了SKIP_DB_BUILD，跳过数据库查询
  if (process.env.SKIP_DB_BUILD === "1") {
    console.log("🔧 SKIP_DB_BUILD已设置：跳过数据库查询");
    return true;
  }
  
  // 在本地生产构建时，跳过数据库查询
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    console.log("🔧 本地生产构建（无数据库连接）：跳过数据库查询");
    return true;
  }
  
  // 运行时不应该跳过数据库查询
  return false;
}

export function getBuildTimeFallback<T>(fallback: T): T {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过数据库查询，使用默认值");
    return fallback;
  }
  throw new Error("此函数只能在构建时调用");
} 
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
  // 添加详细的调试日志
  console.log("🔍 构建检查调试信息:", {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    SKIP_DB_BUILD: process.env.SKIP_DB_BUILD,
    DATABASE_URL: process.env.DATABASE_URL ? "已设置" : "未设置"
  });
  
  // 只在构建时跳过数据库查询，运行时应该正常工作
  
  // 在Vercel构建环境中，总是跳过数据库查询
  if (process.env.VERCEL === "1" && process.env.NODE_ENV === "production") {
    console.log("🔧 Vercel构建环境：跳过数据库查询");
    return true;
  }
  
  // 在本地生产构建时，如果设置了SKIP_DB_BUILD，跳过查询
  if (process.env.NODE_ENV === "production" && process.env.SKIP_DB_BUILD === "1") {
    console.log("🔧 本地生产构建：跳过数据库查询");
    return true;
  }
  
  // 额外的安全检查：确保我们不在运行时跳过查询
  // 如果NODE_ENV是production但没有设置SKIP_DB_BUILD，说明这是运行时
  if (process.env.NODE_ENV === "production" && process.env.SKIP_DB_BUILD !== "1") {
    console.log("✅ 生产环境运行时：允许数据库查询");
    return false;
  }
  
  console.log("✅ 运行时：允许数据库查询");
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
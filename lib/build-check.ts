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
  // 在构建时，如果数据库连接失败，跳过查询
  if (process.env.NODE_ENV === "production") {
    // 检查是否有有效的数据库连接
    const hasValidDbUrl = process.env.DATABASE_URL && 
                         process.env.DATABASE_URL !== "file:./dev.db" &&
                         process.env.DATABASE_URL !== "file:./prod.db";
    
    // 如果没有有效的数据库URL，或者是在Vercel构建环境中，跳过查询
    // 或者在本地构建时强制跳过（因为Supabase连接可能不稳定）
    return !hasValidDbUrl || process.env.VERCEL === "1" || process.env.SKIP_DB_BUILD === "1";
  }
  
  return false;
}

export function getBuildTimeFallback<T>(fallback: T): T {
  if (shouldSkipDatabaseQuery()) {
    console.log("🔧 构建时：跳过数据库查询，使用默认值");
    return fallback;
  }
  throw new Error("此函数只能在构建时调用");
} 
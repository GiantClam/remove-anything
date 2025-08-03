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
  // 在Vercel构建环境中，总是跳过数据库查询
  if (process.env.VERCEL === "1") {
    console.log("🔧 Vercel构建环境：跳过数据库查询");
    return true;
  }
  
  // 在本地生产构建时，如果设置了SKIP_DB_BUILD，跳过查询
  if (process.env.NODE_ENV === "production" && process.env.SKIP_DB_BUILD === "1") {
    console.log("🔧 本地生产构建：跳过数据库查询");
    return true;
  }
  
  // 在构建时，如果数据库连接失败，跳过查询
  if (process.env.NODE_ENV === "production") {
    // 检查是否有有效的数据库连接
    const hasValidDbUrl = process.env.DATABASE_URL && 
                         process.env.DATABASE_URL !== "file:./dev.db" &&
                         process.env.DATABASE_URL !== "file:./prod.db";
    
    // 如果没有有效的数据库URL，跳过查询
    if (!hasValidDbUrl) {
      console.log("🔧 生产环境：没有有效的数据库URL，跳过查询");
      return true;
    }
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
/**
 * 检查是否在构建时运行
 * 在构建时跳过数据库查询等操作
 */
export function shouldSkipDatabaseQuery(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production';
}

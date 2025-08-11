/**
 * 本地开发环境默认用户登录支持
 */

export const DEV_USER = {
  id: "dev-user-123",
  name: "开发测试用户",
  email: "dev@test.com",
  image: "https://avatars.githubusercontent.com/u/1234567?v=4",
};

/**
 * 检查是否为开发模式
 */
export function isDevMode(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (process.env.GOOGLE_CLIENT_ID === "google-client-id-placeholder" ||
      !process.env.GOOGLE_CLIENT_ID ||
      process.env.DEV_AUTO_LOGIN === "true")
  );
}

/**
 * 获取开发环境模拟会话
 */
export function getDevSession() {
  if (!isDevMode()) return null;

  return {
    user: DEV_USER,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天
  };
}

/**
 * 检查是否启用开发自动登录
 */
export function shouldAutoLogin(): boolean {
  return isDevMode() && typeof window !== "undefined";
}

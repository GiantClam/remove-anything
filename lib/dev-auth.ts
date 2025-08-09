/**
 * 开发环境模拟用户登录工具
 */

export const DEV_USER = {
  id: "dev-user-123",
  name: "开发测试用户",
  email: "dev@test.com",
  image: "https://avatars.githubusercontent.com/u/1234567?v=4",
};

export function isDevMode() {
  return process.env.NODE_ENV === "development" && 
         (process.env.GOOGLE_CLIENT_ID === "google-client-id-placeholder" || 
          !process.env.GOOGLE_CLIENT_ID);
}

export function getDevSession() {
  if (!isDevMode()) return null;
  
  return {
    user: DEV_USER,
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };
}

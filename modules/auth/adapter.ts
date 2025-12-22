import type { AuthProvider, AuthSession } from './sdk';

/**
 * 创建项目特定的 AuthProvider
 * 
 * 注意：这是一个占位符实现。在实际项目中，你需要：
 * 1. 实现 getCurrentUser 函数来获取当前用户
 * 2. 或者使用 examples/auth/adapter.example.ts 中的示例
 * 
 * 示例：
 * ```ts
 * import { createAuthProvider } from '../examples/auth/adapter.example';
 * 
 * const auth = createAuthProvider({
 *   getCurrentUser: async () => {
 *     // 你的认证逻辑
 *   }
 * });
 * ```
 */
export function createProjectAuthProvider(
  getCurrentUser?: (req?: any) => Promise<{ id: string; email?: string; name?: string } | null>
): AuthProvider {
  return {
    async getCurrentUser(req?: any): Promise<AuthSession | null> {
      if (!getCurrentUser) {
        throw new Error('请提供 getCurrentUser 函数，或使用 examples/auth/adapter.example.ts 中的示例');
      }
      const u = await getCurrentUser(req);
      if (!u) return null;
      return { userId: u.id, email: u.email, name: u.name };
    },
  };
}

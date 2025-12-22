/**
 * Auth 适配器示例
 * 
 * 这是一个示例实现，展示如何为 Auth 模块创建适配器。
 * 你需要根据你的认证系统（如 Clerk、NextAuth、自定义等）调整实现。
 * 
 * 使用方式：
 * ```ts
 * import { createAuthProvider } from './adapter.example';
 * 
 * const auth = createAuthProvider({
 *   getCurrentUser: async () => {
 *     // 你的认证逻辑
 *     return { id: 'user-1', email: 'user@example.com', name: 'User' };
 *   }
 * });
 * ```
 */

import type { AuthProvider, AuthSession } from '../../auth/sdk';

interface AuthAdapterConfig {
  /**
   * 获取当前用户的函数
   * 你需要根据你的认证系统实现此函数
   */
  getCurrentUser: (req?: any) => Promise<{ id: string; email?: string; name?: string } | null>;
}

/**
 * 创建 AuthProvider 实现
 */
export function createAuthProvider(config: AuthAdapterConfig): AuthProvider {
  return {
    async getCurrentUser(req?: any): Promise<AuthSession | null> {
      const user = await config.getCurrentUser(req);
      if (!user) return null;
      
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
      };
    },
  };
}

/**
 * 示例：Clerk 认证适配器
 */
export function createClerkAuthProvider(): AuthProvider {
  return createAuthProvider({
    getCurrentUser: async () => {
      // 示例：使用 Clerk
      // const { auth } = await clerkClient();
      // const userId = auth()?.userId;
      // if (!userId) return null;
      // const user = await clerkClient.users.getUser(userId);
      // return { id: user.id, email: user.emailAddresses[0]?.emailAddress, name: user.fullName };
      throw new Error('请实现 Clerk 认证逻辑');
    },
  });
}

/**
 * 示例：NextAuth 认证适配器
 */
export function createNextAuthProvider(getServerSession: any): AuthProvider {
  return createAuthProvider({
    getCurrentUser: async (req) => {
      // 示例：使用 NextAuth
      // const session = await getServerSession(req);
      // if (!session?.user) return null;
      // return { id: session.user.id, email: session.user.email, name: session.user.name };
      throw new Error('请实现 NextAuth 认证逻辑');
    },
  });
}


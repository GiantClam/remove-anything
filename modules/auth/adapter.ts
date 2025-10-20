import type { AuthProvider, AuthSession } from './sdk';
import { getCurrentUser as projectGetCurrentUser } from '@/lib/auth-utils';

export function createProjectAuthProvider(): AuthProvider {
  return {
    async getCurrentUser(_req?: any): Promise<AuthSession | null> {
      const u = await projectGetCurrentUser();
      if (!u) return null;
      return { userId: u.id, email: (u as any).email, name: (u as any).name };
    }
  };
}



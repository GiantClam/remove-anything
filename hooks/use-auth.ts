"use client";

import { useSession } from "next-auth/react";
import { isDevMode, getDevSession } from "@/lib/dev-auth";

export function useAuth() {
  const { data: session, status } = useSession();

  // 在开发模式下使用模拟用户
  if (isDevMode() && typeof window !== "undefined") {
    const devSession = getDevSession();
    if (devSession) {
      return {
        userId: devSession.user.id,
        user: devSession.user,
        isLoaded: true,
        isSignedIn: true,
        signOut: () => {
          console.log("🔧 开发模式：模拟登出");
          return Promise.resolve();
        },
      };
    }
  }

  return {
    userId: session?.user?.id || null,
    user: session?.user || null,
    isLoaded: status !== "loading",
    isSignedIn: !!session?.user,
    signOut: () => {
      // This will be handled by NextAuth signOut
      return Promise.resolve();
    },
  };
} 
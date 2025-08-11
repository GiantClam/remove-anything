"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { isDevMode, getDevSession } from "@/lib/dev-auth";

export function useAuth() {
  const { data: session, status } = useSession();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 服务器端：总是返回真实的session状态，避免水合错误
  if (!isClient) {
    return {
      userId: session?.user?.id || null,
      user: session?.user || null,
      isLoaded: status !== "loading",
      isSignedIn: !!session?.user,
      signOut: () => {
        return Promise.resolve();
      },
    };
  }

  // 客户端：检查开发模式
  if (isDevMode()) {
    const devSession = getDevSession();
    if (devSession) {
      return {
        userId: devSession.user.id,
        user: devSession.user,
        isLoaded: true,
        isSignedIn: true,
        signOut: () => {
          console.log("🔧 开发模式：模拟登出");
          if (confirm("开发模式登出：是否刷新页面？")) {
            window.location.reload();
          }
          return Promise.resolve();
        },
      };
    }
  }

  // 客户端：返回真实的session状态
  return {
    userId: session?.user?.id || null,
    user: session?.user || null,
    isLoaded: status !== "loading",
    isSignedIn: !!session?.user,
    signOut: () => {
      return Promise.resolve();
    },
  };
} 
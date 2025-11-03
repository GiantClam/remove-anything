"use client";

import { useAuth } from "@/hooks/use-auth";
import { isDevMode } from "@/lib/dev-auth";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export function DevAuthIndicator() {
  const { isSignedIn, user } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 只在客户端且开发模式下显示，避免水合错误
  if (!isClient || !isDevMode()) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-background/80 backdrop-blur-sm rounded-lg p-3 border shadow-lg">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={isSignedIn ? "default" : "secondary"}>
          {isSignedIn ? "✅ 已登录" : "❌ 未登录"}
        </Badge>
        {isSignedIn && user && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">用户:</span>
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">({user.email})</span>
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        🔧 开发模式自动登录
      </div>
    </div>
  );
}

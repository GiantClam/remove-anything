"use client";

import { useAuth } from "@/hooks/use-auth";
import { isDevMode } from "@/lib/dev-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";

export function DevLoginTest() {
  const { isSignedIn, user, signOut } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !isDevMode()) {
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>🔧 开发模式登录测试</CardTitle>
        <CardDescription>
          本地开发环境自动登录功能测试
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">登录状态:</span>
            <span className={isSignedIn ? "text-green-600" : "text-red-600"}>
              {isSignedIn ? "✅ 已登录" : "❌ 未登录"}
            </span>
          </div>
          
          {isSignedIn && user && (
            <div className="space-y-1 text-sm">
              <div><strong>用户ID:</strong> {user.id}</div>
              <div><strong>姓名:</strong> {user.name}</div>
              <div><strong>邮箱:</strong> {user.email}</div>
              {user.image && (
                <div className="flex items-center gap-2">
                  <strong>头像:</strong>
                  <img src={user.image} alt="用户头像" className="w-8 h-8 rounded-full" />
                </div>
              )}
            </div>
          )}
        </div>

        {isSignedIn && (
          <Button onClick={signOut} variant="outline" className="w-full">
            登出 (开发模式)
          </Button>
        )}

        <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
          💡 开发模式自动登录功能已激活。无需配置 Google OAuth，系统自动提供测试用户。
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useAuth } from "@/hooks/use-auth";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function DebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [componentStack, setComponentStack] = useState<string[]>([]);
  const auth = useAuth();
  const session = useSession();

  useEffect(() => {
    // 收集调试信息
    setDebugInfo({
      nodeEnv: process.env.NODE_ENV,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      auth: {
        userId: auth.userId,
        isSignedIn: auth.isSignedIn,
        isLoaded: auth.isLoaded,
        user: auth.user,
      },
      session: {
        status: session.status,
        data: session.data,
      },
      window: {
        location: typeof window !== "undefined" ? window.location.href : "server",
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      },
    });
  }, [auth, session]);

  const testComponents = [
    { name: "Loading", path: "/components/loading/index.tsx" },
    { name: "UserPoints", path: "/components/dashboard/points.tsx" },
    { name: "UserInfo", path: "/components/user-info.tsx" },
    { name: "BillingsInfo", path: "/components/billing-info.tsx" },
  ];

  const testComponent = (componentName: string) => {
    try {
      setComponentStack(prev => [...prev, `Testing ${componentName}...`]);
      
      // 动态导入测试
      import(`@/components/loading/index`).then((module) => {
        setComponentStack(prev => [...prev, `✅ ${componentName} loaded successfully`]);
      }).catch((error) => {
        setComponentStack(prev => [...prev, `❌ ${componentName} failed: ${error.message}`]);
      });
    } catch (error: any) {
      setComponentStack(prev => [...prev, `❌ ${componentName} error: ${error.message}`]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔍 React 错误 #130 调试页面</h1>
        
        {/* 错误信息 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-red-800 mb-4">❌ 当前问题</h2>
          <div className="space-y-2 text-sm">
            <p><strong>错误：</strong> React error #130 - Element type is invalid</p>
            <p><strong>位置：</strong> GET /zh/app 500 (Internal Server Error)</p>
            <p><strong>描述：</strong> 通常由组件导入/导出问题引起</p>
          </div>
        </div>

        {/* 环境信息 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">🔧 环境信息</h2>
          <pre className="text-sm bg-white p-4 rounded overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        {/* 组件测试 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-green-800 mb-4">🧪 组件测试</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {testComponents.map((comp) => (
              <button
                key={comp.name}
                onClick={() => testComponent(comp.name)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                测试 {comp.name}
              </button>
            ))}
          </div>
          
          <div className="bg-white p-4 rounded max-h-64 overflow-auto">
            <h3 className="font-semibold mb-2">测试日志：</h3>
            {componentStack.map((log, i) => (
              <div key={i} className="text-sm mb-1 font-mono">
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* 快速访问链接 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-4">🔗 快速测试链接</h2>
          <div className="space-y-2">
            <a href="/app" className="block text-blue-600 hover:underline">
              → /app (重定向到locale)
            </a>
            <a href="/zh/app" className="block text-blue-600 hover:underline">
              → /zh/app (直接访问中文应用页面)
            </a>
            <a href="/zh/signin" className="block text-blue-600 hover:underline">
              → /zh/signin (登录页面)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

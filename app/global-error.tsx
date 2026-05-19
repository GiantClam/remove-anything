'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 记录错误到控制台
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-bold">出现了一些问题</h2>
            <p className="mb-4 text-gray-600">
              抱歉，应用程序遇到了一个错误。请稍后再试。
            </p>
            <button
              onClick={reset}
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
} 
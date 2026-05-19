"use client";

import React, { useEffect } from "react";
import Script from "next/script";
import { env } from "@/env.mjs";

export default function ClaritySnippet() {
  const clarityId = env.NEXT_PUBLIC_CLARITY_ID;

  useEffect(() => {
    if (!clarityId) {
      return;
    }

    // 使用 requestIdleCallback 延迟加载 Clarity，避免阻塞首屏
    const loadClarity = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // Clarity 脚本通过 lazyOnload 策略自动延迟加载
        }, { timeout: 2000 });
      }
    };

    loadClarity();
  }, [clarityId]);

  if (!clarityId) {
    return null;
  }

  return (
    <Script
      id="clarity-base"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${clarityId}");;
`,
      }}
    />
  );
}

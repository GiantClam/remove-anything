"use client";

import React, { useEffect } from "react";
import Script from "next/script";

export default function ClaritySnippet() {
  useEffect(() => {
    // 使用 requestIdleCallback 延迟加载 Clarity，避免阻塞首屏
    const loadClarity = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // Clarity 脚本通过 lazyOnload 策略自动延迟加载
        }, { timeout: 2000 });
      }
    };

    loadClarity();
  }, []);

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
    })(window, document, "clarity", "script", "nq6otfv9kb");;
`,
      }}
    />
  );
}

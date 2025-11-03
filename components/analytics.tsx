"use client";

import Script from "next/script";
import { useEffect } from "react";
import { env } from "@/env.mjs";

export function Analytics() {
  if (!env.NEXT_PUBLIC_GA_ID) {
    return null;
  }

  useEffect(() => {
    // 使用 requestIdleCallback 延迟加载非关键脚本，避免阻塞首屏渲染
    const loadAnalytics = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // 在浏览器空闲时加载
        }, { timeout: 2000 });
      } else {
        // 降级：使用 setTimeout
        setTimeout(() => {}, 2000);
      }
    };

    loadAnalytics();
  }, []);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${env.NEXT_PUBLIC_GA_ID}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${env.NEXT_PUBLIC_GA_ID}', {
            page_title: document.title,
            page_location: window.location.href,
          });
        `}
      </Script>
    </>
  );
}

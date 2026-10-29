"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { env } from "@/env.mjs";
import { isGaDebugMode, pageview } from "@/lib/gtag";

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gaId = env.NEXT_PUBLIC_GA_ID;
  const debugMode = isGaDebugMode(searchParams);

  useEffect(() => {
    if (!gaId) {
      return;
    }

    const query = searchParams?.toString();
    const url = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;

    const sendPageView = () => {
      if (typeof window.gtag === "function" && debugMode) {
        window.gtag("config", gaId, {
          send_page_view: false,
          anonymize_ip: true,
          debug_mode: true,
        });
      }
      pageview(url, document.title);
    };

    if (typeof window.gtag === "function") {
      sendPageView();
      return;
    }

    const timeoutId = window.setTimeout(sendPageView, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [gaId, pathname, searchParams, debugMode]);

  if (!gaId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            send_page_view: false,
            anonymize_ip: true,${debugMode ? "\n            debug_mode: true," : ""}
          });
        `}
      </Script>
    </>
  );
}

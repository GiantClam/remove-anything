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
      if (typeof window.gtag !== "function") {
        return;
      }

      // Config/set debug_mode is what adds `_dbg=1` for GA4 DebugView.
      // Putting debug_mode only on event params becomes `ep.debug_mode` and is ignored.
      if (debugMode) {
        window.gtag("set", { debug_mode: true });
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

  // Read location.search inside the inline script so the first gtag config
  // gets debug_mode even before React searchParams hydrate.
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
          (function () {
            var debug = /(?:^|[?&])debug_mode=(?:1|true)(?:&|$)/.test(location.search);
            var cfg = { send_page_view: false, anonymize_ip: true };
            if (debug) {
              cfg.debug_mode = true;
              gtag('set', { debug_mode: true });
              // gtag config debug_mode alone often serializes as ep.debug_mode.
              // DebugView reliably keys off collect query _dbg=1 (Tag Assistant /
              // GA Debugger). Patch transport so ?debug_mode=1 always sets it.
              function withDbg(url) {
                if (typeof url !== 'string') return url;
                if (!/\/g\/collect|\/collect\?/.test(url)) return url;
                if (/[?&]_dbg=/.test(url)) return url;
                return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_dbg=1';
              }
              try {
                if (navigator.sendBeacon) {
                  var beacon = navigator.sendBeacon.bind(navigator);
                  navigator.sendBeacon = function (url, data) {
                    return beacon(withDbg(url), data);
                  };
                }
              } catch (e) {}
              try {
                var origFetch = window.fetch;
                window.fetch = function (input, init) {
                  if (typeof input === 'string') {
                    return origFetch.call(this, withDbg(input), init);
                  }
                  if (input && typeof Request !== 'undefined' && input instanceof Request) {
                    var patched = withDbg(input.url);
                    if (patched !== input.url) {
                      return origFetch.call(this, new Request(patched, input), init);
                    }
                  }
                  return origFetch.call(this, input, init);
                };
              } catch (e) {}
              try {
                var XO = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function (method, url) {
                  var args = Array.prototype.slice.call(arguments);
                  if (typeof url === 'string') args[1] = withDbg(url);
                  return XO.apply(this, args);
                };
              } catch (e) {}
            }
            gtag('config', '${gaId}', cfg);
          })();
        `}
      </Script>
    </>
  );
}

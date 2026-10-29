"use client";

import {
  createAnalyticsEvent,
  getAnalyticsPageContext,
  type AnalyticsEventFields,
  type AnalyticsEventName,
} from "@/lib/analytics-events";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type SearchParamsLike = {
  get(name: string): string | null;
} | null | undefined;

/** True when the URL asks for GA4 DebugView (`?debug_mode=1` or `true`). */
export function isGaDebugMode(searchParams?: SearchParamsLike): boolean {
  if (typeof window !== "undefined") {
    const fromWindow = new URLSearchParams(window.location.search).get(
      "debug_mode",
    );
    if (fromWindow === "1" || fromWindow === "true") {
      return true;
    }
  }

  const fromParams = searchParams?.get("debug_mode");
  return fromParams === "1" || fromParams === "true";
}

function attachGaDebugMode<T extends Record<string, unknown>>(params: T): T {
  if (!isGaDebugMode()) return params;
  // Keep ep.debug_mode for sinks that accept it; transport patch adds _dbg=1.
  return { ...params, debug_mode: true };
}

export function pageview(url: string, title?: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const event = createAnalyticsEvent("page_view", {
    page_location: url,
    page_title: title,
  });
  window.gtag("event", event.name, attachGaDebugMode(event.params));
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const event = createAnalyticsEvent(eventName, params);
  window.gtag("event", event.name, attachGaDebugMode(event.params));
}

/** Send one event using the shared P0 funnel vocabulary and field contract. */
export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  fields: AnalyticsEventFields = {},
) {
  const pageContext = typeof window === "undefined"
    ? {}
    : getAnalyticsPageContext(
        window.location.pathname,
        document.documentElement.lang,
      );
  const event = createAnalyticsEvent(eventName, { ...pageContext, ...fields });
  trackEvent(event.name, event.params);
  return event;
}

"use client";

import {
  createAnalyticsEvent,
  type AnalyticsEventFields,
  type AnalyticsEventName,
} from "@/lib/analytics-events";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function pageview(url: string, title?: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const event = createAnalyticsEvent("page_view", {
    page_location: url,
    page_title: title,
  });
  window.gtag("event", event.name, event.params);
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const event = createAnalyticsEvent(eventName, params);
  window.gtag("event", event.name, event.params);
}

/** Send one event using the shared P0 funnel vocabulary and field contract. */
export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  fields: AnalyticsEventFields = {},
) {
  const event = createAnalyticsEvent(eventName, fields);
  trackEvent(event.name, event.params);
  return event;
}

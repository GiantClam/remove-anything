"use client";

import { useEffect } from "react";

import {
  ANALYTICS_EVENTS,
  type AnalyticsEventFields,
} from "@/lib/analytics-events";
import { trackAnalyticsEvent } from "@/lib/gtag";

type ToolViewTrackerProps = {
  toolSlug: string;
  locale: string;
  fields?: AnalyticsEventFields;
};

const EMPTY_FIELDS: AnalyticsEventFields = {};

/** Emits one page-level tool_view for each mounted canonical tool page. */
export function ToolViewTracker({
  toolSlug,
  locale,
  fields = EMPTY_FIELDS,
}: ToolViewTrackerProps) {
  useEffect(() => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.toolView, {
      ...fields,
      tool_slug: toolSlug,
      locale,
      landing_page: window.location.pathname,
    });
  }, [fields, locale, toolSlug]);

  return null;
}

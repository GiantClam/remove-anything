"use client";

import { useEffect, useRef } from "react";

import {
  ANALYTICS_EVENTS,
  type AnalyticsEventFields,
} from "@/lib/analytics-events";
import { trackAnalyticsEvent } from "@/lib/gtag";

type PaywallTrackerProps = {
  open: boolean;
  fields?: AnalyticsEventFields;
};

const EMPTY_FIELDS: AnalyticsEventFields = {};

/** Emits one paywall impression per open transition for credit purchase UI. */
export function PaywallTracker({
  open,
  fields = EMPTY_FIELDS,
}: PaywallTrackerProps) {
  const wasOpen = useRef(false);

  useEffect(() => {
    const opened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opened) return;

    trackAnalyticsEvent(ANALYTICS_EVENTS.paywallViewed, {
      ...fields,
      is_authenticated: fields.is_authenticated ?? true,
    });
  }, [fields, open]);

  return null;
}

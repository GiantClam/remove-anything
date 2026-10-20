import "server-only";

import { prisma } from "@/db/prisma";
import {
  emitServerAnalyticsEvent as emitSharedAnalyticsEvent,
  type AnalyticsEvent,
  type AnalyticsEventSink,
} from "@/lib/analytics-events";

/**
 * Server-only analytics delivery. The shared event builders stay safe for
 * browser bundles, while webhooks, workers, and API routes get an idempotent
 * durable row plus a redacted structured-log fallback.
 */
export async function emitServerAnalyticsEvent(
  event: AnalyticsEvent,
  sink: AnalyticsEventSink = durableAnalyticsEventSink,
): Promise<AnalyticsEvent> {
  return emitSharedAnalyticsEvent(event, sink);
}

async function durableAnalyticsEventSink(event: AnalyticsEvent): Promise<void> {
  console.info(
    "[analytics]",
    JSON.stringify({ event: event.name, ...event.params }),
  );

  const durableEnabled =
    process.env.NODE_ENV === "production" ||
    process.env.ANALYTICS_DURABLE_SINK === "true";
  if (!durableEnabled) return;

  try {
    const params = event.params;
    await prisma.analyticsEvent.create({
      data: {
        eventId: params.event_id,
        name: event.name,
        taskId: params.task_id,
        orderId: params.order_id,
        userId: params.user_id,
        toolSlug: params.tool_slug,
        landingPage: params.landing_page,
        locale: params.locale,
        fileType: params.file_type,
        fileSizeBucket: params.file_size_bucket,
        isAuthenticated: params.is_authenticated,
        plan: params.plan,
        creditsBefore: params.credits_before,
        creditsAfter: params.credits_after,
        experimentId: params.experiment_id,
        payload: params,
      },
    });
  } catch (error) {
    // Event delivery must never turn a completed task, payment webhook, or
    // authorized download into a user-visible failure. A duplicate event is
    // already durable and can be ignored; all other failures remain visible
    // for reconciliation.
    if ((error as { code?: string })?.code !== "P2002") {
      console.warn("[analytics] durable sink unavailable", {
        event_id: event.params.event_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

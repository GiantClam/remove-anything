/**
 * Shared analytics vocabulary and event builders.
 *
 * Client events are sent to GA through `trackAnalyticsEvent` in `lib/gtag`.
 * Server events use `emitServerAnalyticsEvent`, which deliberately accepts a
 * sink so webhooks and workers can use the same contract without depending on
 * a browser global. The default sink writes a structured event to stdout;
 * production can provide a Measurement Protocol or warehouse sink at the
 * application boundary.
 */

export const ANALYTICS_EVENTS = {
  toolView: "tool_view",
  uploadStarted: "upload_started",
  taskCreated: "task_created",
  taskProcessing: "task_processing",
  taskSucceeded: "task_succeeded",
  taskFailed: "task_failed",
  resultDownloaded: "result_downloaded",
  signupStarted: "signup_started",
  signupCompleted: "signup_completed",
  checkoutStarted: "checkout_started",
  orderCreated: "order_created",
  purchaseCompleted: "purchase_completed",
  purchaseFailed: "purchase_failed",
  creditsConsumed: "credits_consumed",
  creditsRefunded: "credits_refunded",
} as const;

export type AnalyticsEventName =
  | (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
  // Existing product events remain valid while they are migrated to the
  // shared vocabulary.
  | (string & {});

export type AnalyticsPrimitive = string | number | boolean;

export type FileSizeBucket = "0-1mb" | "1-5mb" | "5-10mb" | "10-50mb" | "50mb+";

/** Keep upload-size reporting comparable across tools without exposing bytes. */
export function getFileSizeBucket(bytes: number): FileSizeBucket {
  const size = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const megabytes = size / (1024 * 1024);

  if (megabytes <= 1) return "0-1mb";
  if (megabytes <= 5) return "1-5mb";
  if (megabytes <= 10) return "5-10mb";
  if (megabytes <= 50) return "10-50mb";
  return "50mb+";
}

/** Fields shared by the page funnel, task lifecycle, and payment facts. */
export interface AnalyticsEventFields {
  event_id?: string;
  task_id?: string;
  order_id?: string;
  tool_slug?: string;
  landing_page?: string;
  locale?: string;
  file_type?: string;
  file_size_bucket?: string;
  is_authenticated?: boolean;
  plan?: string;
  credits_before?: number;
  credits_after?: number;
  experiment_id?: string;
  [key: string]: AnalyticsPrimitive | undefined;
}

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  params: AnalyticsEventFields & { event_id: string };
}

const TASK_EVENTS = new Set<string>([
  ANALYTICS_EVENTS.taskCreated,
  ANALYTICS_EVENTS.taskProcessing,
  ANALYTICS_EVENTS.taskSucceeded,
  ANALYTICS_EVENTS.taskFailed,
  ANALYTICS_EVENTS.resultDownloaded,
]);

const PAYMENT_EVENTS = new Set<string>([
  ANALYTICS_EVENTS.checkoutStarted,
  ANALYTICS_EVENTS.orderCreated,
  ANALYTICS_EVENTS.purchaseCompleted,
  ANALYTICS_EVENTS.purchaseFailed,
]);

function randomId(): string {
  // `crypto.randomUUID` is available in browsers and modern Node runtimes.
  // Keep a small fallback for older preview/test runtimes.
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createAnalyticsEventId(): string {
  return randomId();
}

/**
 * Build a task event with a stable id. Stable ids let a retried provider
 * webhook be sent more than once while remaining deduplicable downstream.
 */
export function createTaskAnalyticsEvent(
  name: AnalyticsEventName,
  taskId: string | number,
  fields: AnalyticsEventFields = {},
): AnalyticsEvent {
  const task_id = String(taskId);
  return createAnalyticsEvent(name, {
    ...fields,
    task_id,
    event_id: fields.event_id ?? `${name}:task:${task_id}`,
  });
}

/** Build a payment event with a stable order id for webhook retries. */
export function createOrderAnalyticsEvent(
  name: AnalyticsEventName,
  orderId: string | number,
  fields: AnalyticsEventFields = {},
): AnalyticsEvent {
  const order_id = String(orderId);
  return createAnalyticsEvent(name, {
    ...fields,
    order_id,
    event_id: fields.event_id ?? `${name}:order:${order_id}`,
  });
}

/** Build a credit ledger fact with a stable transaction key when available. */
export function createCreditsAnalyticsEvent(
  name: typeof ANALYTICS_EVENTS.creditsConsumed | typeof ANALYTICS_EVENTS.creditsRefunded,
  fields: AnalyticsEventFields & { transaction_id?: string | number } = {},
): AnalyticsEvent {
  const transactionId = fields.transaction_id;
  return createAnalyticsEvent(name, {
    ...fields,
    event_id:
      fields.event_id ??
      (transactionId === undefined
        ? createAnalyticsEventId()
        : `${name}:transaction:${String(transactionId)}`),
  });
}

/**
 * Create an event and enforce the identifier rules from the measurement spec.
 * Unknown legacy names are allowed so callers can migrate incrementally.
 */
export function createAnalyticsEvent(
  name: AnalyticsEventName,
  fields: AnalyticsEventFields = {},
): AnalyticsEvent {
  if (TASK_EVENTS.has(name) && !fields.task_id) {
    throw new Error(`Analytics event "${name}" requires task_id`);
  }

  if (PAYMENT_EVENTS.has(name) && !fields.order_id) {
    throw new Error(`Analytics event "${name}" requires order_id`);
  }

  const params = Object.entries(fields).reduce<AnalyticsEventFields>(
    (clean, [key, value]) => {
      if (value !== undefined) {
        clean[key] = value;
      }
      return clean;
    },
    {},
  );

  params.event_id = params.event_id ?? createAnalyticsEventId();
  return { name, params: params as AnalyticsEvent["params"] };
}

export type AnalyticsEventSink = (event: AnalyticsEvent) => void | Promise<void>;

/**
 * Emit a server fact through a replaceable sink. Keeping the sink injectable
 * makes webhook code deterministic in tests and leaves the GA4/warehouse
 * transport as deployment configuration rather than business logic.
 */
export async function emitServerAnalyticsEvent(
  event: AnalyticsEvent,
  sink: AnalyticsEventSink = defaultAnalyticsEventSink,
): Promise<AnalyticsEvent> {
  await sink(event);
  return event;
}

function defaultAnalyticsEventSink(event: AnalyticsEvent): void {
  // Structured logs are useful even before a GA4 server credential exists and
  // can be collected by the hosting platform without leaking request payloads.
  console.info("[analytics]", JSON.stringify({ event: event.name, ...event.params }));
}

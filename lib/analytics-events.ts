/**
 * Shared analytics vocabulary and event builders.
 *
 * Client events are sent to GA through `trackAnalyticsEvent` in `lib/gtag`.
 * Server events use `emitServerAnalyticsEvent`, which deliberately accepts a
 * sink so webhooks and workers can use the same contract without depending on
 * a browser global. In production the default sink writes a structured event
 * to logs. Server-only callers use `lib/server-analytics-events` when
 * they also need the durable `analytics_events` sink.
 */

export const ANALYTICS_EVENTS = {
  toolView: "tool_view",
  uploadStarted: "upload_started",
  uploadCompleted: "upload_completed",
  retryStarted: "retry_started",
  taskCreated: "task_created",
  taskProcessing: "task_processing",
  taskSucceeded: "task_succeeded",
  taskFailed: "task_failed",
  processingStarted: "processing_started",
  processingCompleted: "processing_completed",
  processingFailed: "processing_failed",
  downloadClicked: "download_clicked",
  resultDownloaded: "result_downloaded",
  upgradeClicked: "upgrade_clicked",
  signupStarted: "signup_started",
  signupCompleted: "signup_completed",
  paywallViewed: "paywall_viewed",
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

/** Shared, privacy-safe file dimensions for client upload behavior. */
export function getFileAnalyticsFields(
  file: { type?: string; size: number },
  isAuthenticated?: boolean,
): Pick<AnalyticsEventFields, "file_type" | "file_size_bucket" | "is_authenticated"> {
  return {
    file_type: file.type || undefined,
    file_size_bucket: getFileSizeBucket(file.size),
    ...(isAuthenticated === undefined
      ? {}
      : { is_authenticated: isAuthenticated }),
  };
}

/** Fields shared by the page funnel, task lifecycle, and payment facts. */
export interface AnalyticsEventFields {
  event_id?: string;
  task_id?: string;
  order_id?: string;
  user_id?: string;
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
  ANALYTICS_EVENTS.retryStarted,
  ANALYTICS_EVENTS.processingStarted,
  ANALYTICS_EVENTS.processingCompleted,
  ANALYTICS_EVENTS.processingFailed,
  ANALYTICS_EVENTS.downloadClicked,
  ANALYTICS_EVENTS.resultDownloaded,
]);

const PAYMENT_EVENTS = new Set<string>([
  ANALYTICS_EVENTS.checkoutStarted,
  ANALYTICS_EVENTS.orderCreated,
  ANALYTICS_EVENTS.purchaseCompleted,
  ANALYTICS_EVENTS.purchaseFailed,
]);

const USER_EVENTS = new Set<string>([ANALYTICS_EVENTS.signupCompleted]);

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
  // Task record IDs are only unique within their backing table. Include the
  // canonical tool namespace whenever the caller knows it so downloads and
  // lifecycle facts from different task tables cannot collide in the durable
  // event sink. Keep the legacy format for callers that have not migrated
  // their task namespace yet.
  const taskNamespace = fields.tool_slug
    ? `${String(fields.tool_slug)}:`
    : "";
  return createAnalyticsEvent(name, {
    ...fields,
    task_id,
    event_id: fields.event_id ?? `${name}:task:${taskNamespace}${task_id}`,
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

/** Build an account lifecycle event with a stable user identity for retries. */
export function createUserAnalyticsEvent(
  name: AnalyticsEventName,
  userId: string | number,
  fields: AnalyticsEventFields = {},
): AnalyticsEvent {
  const user_id = String(userId);
  return createAnalyticsEvent(name, {
    ...fields,
    user_id,
    event_id: fields.event_id ?? `${name}:user:${user_id}`,
  });
}

/** Build a credit ledger fact with a stable transaction key when available. */
export function createCreditsAnalyticsEvent(
  name:
    | typeof ANALYTICS_EVENTS.creditsConsumed
    | typeof ANALYTICS_EVENTS.creditsRefunded,
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

  if (USER_EVENTS.has(name) && !fields.user_id) {
    throw new Error(`Analytics event "${name}" requires user_id`);
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

const ANALYTICS_LOCALES = new Set([
  "en",
  "zh-tw",
  "fr",
  "ja",
  "ko",
  "de",
  "pt",
  "es",
  "ar",
]);

const CORE_TOOL_SLUGS = new Set([
  "remove-background",
  "transparent-png-maker",
  "white-background-maker",
  "change-background-color",
  "remove-watermark",
  "remove-objects",
]);

/** Resolve only explicit route context; never infer a tool from arbitrary query data. */
export function getAnalyticsPageContext(
  pathname: string,
  htmlLang?: string,
): Pick<AnalyticsEventFields, "landing_page" | "locale" | "tool_slug"> {
  const segments = pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);
  const prefix = segments[0]?.toLowerCase();
  const prefixedLocale =
    prefix && ANALYTICS_LOCALES.has(prefix) ? prefix : undefined;
  const localeFromHtml = htmlLang?.toLowerCase();
  const htmlLocale =
    localeFromHtml && ANALYTICS_LOCALES.has(localeFromHtml)
      ? localeFromHtml
      : undefined;
  const canonicalSegments = prefixedLocale ? segments.slice(1) : segments;
  const slug =
    canonicalSegments.length === 1 && CORE_TOOL_SLUGS.has(canonicalSegments[0])
      ? canonicalSegments[0]
      : undefined;

  return {
    landing_page: pathname.split("?")[0].split("#")[0] || "/",
    ...(prefixedLocale || htmlLocale
      ? { locale: prefixedLocale || htmlLocale }
      : {}),
    ...(slug ? { tool_slug: slug } : {}),
  };
}

/** Build a client event with explicit route context and a generated event_id. */
export function createClientAnalyticsEvent(
  name: AnalyticsEventName,
  pathname: string,
  htmlLang?: string,
  fields: AnalyticsEventFields = {},
): AnalyticsEvent {
  return createAnalyticsEvent(name, {
    ...getAnalyticsPageContext(pathname, htmlLang),
    ...fields,
  });
}

export type AnalyticsEventSink = (
  event: AnalyticsEvent,
) => void | Promise<void>;

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

async function defaultAnalyticsEventSink(event: AnalyticsEvent): Promise<void> {
  // Client-safe shared code keeps the default sink limited to structured logs.
  // Server-only callers import `lib/server-analytics-events` for durability.
  console.info(
    "[analytics]",
    JSON.stringify({ event: event.name, ...event.params }),
  );
}

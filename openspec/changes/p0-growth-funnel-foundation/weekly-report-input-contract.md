# Weekly funnel report input contract

`scripts/weekly-funnel-report.mjs` is an offline import and review helper. It never connects to GA4, Search Console, a payment provider, a task database, or a provider. A report is evidence about the supplied exports only; it is not evidence that a property received no traffic when an export is absent.

## Envelope and provenance

The input is one JSON object. `metadata` is the report cohort provenance and should include:

```json
{
  "source": "GA4 Data API export",
  "property_id": "...",
  "stream_id": "...",
  "retrieved_at": "2026-10-15T00:00:00Z",
  "window": {
    "start": "2026-10-01T00:00:00Z",
    "end": "2026-10-08T00:00:00Z",
    "time_zone": "UTC"
  }
}
```

The report treats windows as inclusive at `start` and exclusive at `end`. `source`, retrieval time, property/stream identifiers, and query boundaries are printed. Missing provenance is `NO DATA`; the tool does not infer it from event timestamps.

Top-level datasets are optional and may be supplied as an array or as `{ "metadata": {}, "rows": [] }`:

- `events`: flat event facts or a GA4 Data API response with `dimensionHeaders`, `metricHeaders`, and `rows`.
- `tasks`: one fact per logical task, with `task_id`, dimensions, `task_status`, `latency_ms` or `started_at`/`completed_at`, and optional positive integer `attempt_count`.
- `purchases`: order facts with `order_id`, `customer_id`, RFC3339 `purchased_at`, and an asserted boolean `is_first_purchase`. Set dataset metadata `complete: true` and provide coverage through every first-order + 30-day deadline before using repeat purchase metrics.
- `costs`: cost facts with `cost_id`, `tool_slug`, ISO-4217 `currency`, and optional numeric `provider_cost`, `retry_cost`, `storage_cost`, and `credits_consumed`.
- `gsc`: Search Console rows with declared `dimensions` including `page`, either dimension fields or `keys`, and numeric `impressions`, `clicks`, and optional `position`.

## Events and deduplication

Flat events count once per record. Identical flat records with the same `eventName` + `event_id` are counted once; conflicting records for that key are excluded. Flat records without `event_id` cannot be deduplicated and are reported in the data-quality section. A flat row may carry `params`; top-level fields take precedence after flattening.

GA4 rows are aggregate observations. The script maps dimensions by the declared header names, not by position. A GA row without `dimensionHeaders` is excluded because a positional guess can put a count under the wrong locale, page, or event. `eventCount`/`count` must be a non-negative integer; invalid counts retain a `NO DATA` subtotal instead of becoming zero. GA aggregate upstream deduplication and user identity are outside this helper's evidence.

The funnel table reports event occurrences by `landing_page`, `tool_slug`, `locale`, and `is_authenticated`; `impressions` and `visits` remain explicit `NO DATA` in that dimensional table until reliable joins are supplied. An event-count ratio is never labeled a user or session conversion rate. Visits, distinct users, active users, and user-level conversion remain `NO DATA` unless a future input contract supplies identity/session cohorts. The report maps only the compatibility pairs `processing_started`/`task_processing`, `processing_completed`/`task_succeeded`, and `processing_failed`/`task_failed`; other event names remain separate in event totals.

## Reliability and purchase semantics

Task latency uses explicit `latency_ms`, otherwise valid `completed_at - started_at`, for `succeeded` and `failed` tasks only. p50/p95 use nearest-rank milliseconds. Failure is `failed / (succeeded + failed)`; retries are `attempt_count > 1 / tasks with a known positive integer attempt_count`. These are imported-cohort facts and do not estimate site-wide rates. Canceled and expired tasks are excluded from the failure denominator.

Thirty-day repeat uses only customers with exactly one ledger-asserted `is_first_purchase: true` order in the report window. A repeat is a different order strictly before that first order's +30-day deadline. The purchase ledger must declare `complete: true` and cover every follow-up interval; immature customers are shown separately and do not enter the denominator. Missing customer/order/time assertions result in `NO DATA` rather than an inferred repeat rate.

Cost totals are grouped by tool and currency and require non-conflicting `cost_id` facts. Missing cost components remain `NO DATA` with a known subtotal where possible. These facts do not approve paid output, establish margin, or replace a cost approval record.

GSC metrics are grouped by declared dimension keys, deduplicated only for identical keys, and then aggregated by page. CTR is clicks divided by impressions only when both complete and impressions are positive. Position is impression-weighted. Search clicks are not GA visits or users.

## Explicitly unimplemented

The report keeps `NO DATA` for visits, user/session funnels, active_users_30d, authoritative missing-event counts, revenue/margin, cost per successful output, cross-source identity joins, and any metric whose source, coverage, or quality gate is missing. Empty input, unavailable input, or a zero count must not be described as no traffic.

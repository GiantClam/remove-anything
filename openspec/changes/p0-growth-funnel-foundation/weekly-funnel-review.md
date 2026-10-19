# Weekly funnel review

Run this review once per week after exporting the latest GA4 and Search Console data. The report is evidence-first: an unavailable metric is recorded as `NO DATA` with its source and retrieval time instead of being converted into a zero.

## Required slices

- landing page and canonical tool slug
- locale and country
- authenticated versus anonymous visitor
- file type and file-size bucket
- experiment ID, when present

## Funnel and reliability fields

`impressions`, `visits`, `tool_view`, `upload_started`, `processing_started`, `processing_completed`, `processing_failed`, `result_downloaded`, `signup_completed`, `checkout_started`, `purchase_completed`, `credits_consumed`, `active_users_30d`, `p50_latency_ms`, `p95_latency_ms`, `retry_rate`, `expired_tasks`, `missing_event_count`, `provider_cost`, and `credit_cost`.

## Decision record

For every material change, record the source export date, property/stream or GSC property, query window, owner, decision, expected impact, and the next validation date. Do not start the 28-day baseline or expand P1 pages until the GA4/GSC release gates and the three-page impression gate are satisfied.

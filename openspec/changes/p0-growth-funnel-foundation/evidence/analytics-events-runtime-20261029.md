# analytics_events runtime delivery evidence

Observed: 2026-10-29 23:35 Asia/Shanghai (CST, UTC+8). SELECT-only against production Supabase project `ofmwvapsmsokwvqhwhtf` (`remove-anything`).

## Code path (server)

- Shared builders: `lib/analytics-events.ts` (stable `event_id`, task/order/user helpers).
- Durable sink: `lib/server-analytics-events.ts` → `prisma.analyticsEvent.create`.
- Enablement: runs when `NODE_ENV === "production"` or `ANALYTICS_DURABLE_SINK=true`.
- Idempotent redelivery: Prisma unique violation `P2002` is swallowed (duplicate already durable). Other sink errors are `console.warn` only and **must not** fail the user request.
- Unit coverage: `tests/growth/server-analytics-events.test.ts` asserts field mapping and that duplicate/`failure` modes do not reject.
- **No outbox / delayed retry worker** exists for non-duplicate sink failures; recovery today is log-visible reconciliation, not automatic replay.

## Production receipt (runtime, not schema-only)

Total rows in `analytics_events`: **20**.

| name | n | first_at (DB timestamp) | last_at (DB timestamp) |
| --- | ---: | --- | --- |
| `processing_failed` | 10 | 2026-10-21 17:25:17.803 | 2026-10-29 09:00:48.559 |
| `result_downloaded` | 8 | 2026-10-29 01:52:40.623 | 2026-10-29 15:30:58.762 |
| `processing_completed` | 2 | 2026-10-29 11:27:36.430 | 2026-10-29 15:29:09.966 |

By tool_slug (selected):

| tool_slug | name | n |
| --- | --- | ---: |
| remove-background | processing_completed | 2 |
| remove-background | processing_failed | 3 |
| remove-background | result_downloaded | 2 |
| remove-objects | result_downloaded | 2 |
| remove-watermark | result_downloaded | 3 |
| sora2-video-watermark-removal | result_downloaded | 1 |
| (null) | processing_failed | 7 |

Tonight’s free canaries (same window as `production-bg-object-postpersist-canary-20261029.md` / watermark PASS) include namespaced ids:

- `result_downloaded:task:remove-background:282`
- `processing_completed:task:remove-background:282`
- `result_downloaded:task:remove-objects:47`
- earlier same calendar day: `result_downloaded:task:remove-watermark:6` / `:7`

## What this closes vs leaves open

**Closed / accepted now**

- Runtime durable delivery for server facts that the free canaries and recent production traffic actually emit: `processing_completed`, `processing_failed`, `result_downloaded`.
- Stable namespaced `event_id` format with `tool_slug` when present (collision fix live in production receipts).
- Idempotent duplicate handling contract (code + unit test). Schema-level uniqueness was already proven in `production-schema-postcutover.md`.

**Still open (do not check off the full tasks.md item)**

- Full behavioral chain across six tools + signup + paywall + checkout + purchase (`signup_completed` / `checkout_started` / `order_created` / `purchase_*` / `credits_*` / `task_created` counts in production: **0**).
- Automatic retry/recovery for non-duplicate durable-sink outages (no queue).
- Weekly production GA4/GSC export receipt (`tasks.md` measurement item for funnel metrics).
- GA4 DebugView evidence for the same server facts (not invented; not captured this turn).

## Stripe note (same turn)

Production `STRIPE_WEBHOOK_SECRET` was later configured on 2026-10-29 (Asia/Shanghai); see `evidence/stripe-production-webhook-20261029.md` (supersedes `evidence/stripe-production-webhook-blocker-20261029.md`). Preview/Development remain on test-mode secrets. No secret values recorded here.

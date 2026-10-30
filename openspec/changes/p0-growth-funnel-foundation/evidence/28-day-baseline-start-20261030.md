# 28-day growth measurement baseline — STARTED — 2026-10-30 (Asia/Shanghai)

Authority: t39u “全部需要验证，允许所有的预算”; user continue through t47u. OpenSpec: `specs/measurement-and-attribution/spec.md` (GA4 DebugView + GSC + production `NEXT_PUBLIC_GA_ID` required before baseline begins); `tasks.md` “Start the 28-day baseline only after every release gate passes”; `weekly-funnel-review.md` / `owners.md` for operating cadence.

## Gate checklist (measurement release gates)

| Gate | Status | Evidence |
| --- | --- | --- |
| Production `NEXT_PUBLIC_GA_ID` = `G-VD6F0YDBQ5` | PASS | `production-ga4-realtime-20261021.md`, live DebugView collect |
| GA4 DebugView ingestion | PASS | `ga4-debugview-pass-20261030.md` (+ screenshots) |
| GSC domain verification | PASS | `gsc-authenticated-property-20261029.md` |
| Supporting P0 ops (not measurement-blockers, recorded) | PASS / residual noted | Private R2 cutover PASS (`production-private-r2-cutover-pass-20261030.md`); FULL_OUTPUT + paid tools; retention execute; live Checkout webhook canary (`stripe-production-live-checkout-canary-20261030.md`); overdue cancel; RH balance restored. Provider file purge residual (no RH delete API). |

## Window

| Field | Value |
| --- | --- |
| Time zone | Asia/Shanghai (UTC+8) |
| **Baseline start** | **2026-10-30 12:00:00 CST** (`2026-10-30T12:00:00+08:00`) |
| Window length | 28 days |
| End (exclusive) | 2026-11-27 12:00:00 CST (`2026-11-27T12:00:00+08:00`) |
| Inclusive calendar days | 2026-10-30 … 2026-11-26 |
| Property / stream | GA4 property `559043519`, stream `16131661294`, Measurement ID `G-VD6F0YDBQ5` |
| GSC property | `sc-domain:remove-anything.com` |

Do **not** expand to P1 pages until the end-of-window gates in `proposal.md` / `tasks.md` pass: ≥3 core pages with real GSC impressions, stable processing/download baselines, and ≥1 attributable registration / purchase / sales lead.

## Configs / env / cron (explicit)

No new production env flag starts the baseline. Measurement is observational against the already-deployed stack:

- Keep `NEXT_PUBLIC_GA_ID=G-VD6F0YDBQ5`.
- Keep `R2_PRIVATE_BUCKET` set to the private production bucket (do **not** reverse).
- Keep `FULL_OUTPUT_IMPLEMENTATION_ENABLED` and paid registry flags as already enabled for the approved tools.
- Keep retention execute / overdue-cancel flags as already canaried; continue bounded batches per `retention-runbook.md`.
- Existing Vercel crons remain the only scheduled app jobs (`/api/cron/process-queue` every minute; cleanup-tasks as configured). **No new cron** was added for the baseline itself.
- Weekly review is a **human/ops** cadence, not an app cron: Product/Growth owner exports GA4 + GSC and runs `scripts/weekly-funnel-report.mjs` per `weekly-report-input-contract.md` (`owners.md`: funnel Monday, reliability Tuesday, measurement quality before funnel review).

## Monitoring notes

1. **Weekly exports** — GA4 Data API / UI export + GSC performance export for the prior complete week; record `retrieved_at` and window in Asia/Shanghai or UTC with explicit zone.
2. **Required slices** — landing page, tool slug, locale, country, auth vs anon, file type/size bucket (`weekly-funnel-review.md`).
3. **NO DATA rule** — missing metrics stay `NO DATA` with source + retrieval time; never coerce to zero.
4. **Decision log** — for each material change during the window, record source export date, property/stream, query window, owner, decision, expected impact, next validation date.
5. **P1 hold** — no P1 page expansion until impression / funnel / attributable-signal gates pass after the window.
6. **Residuals tracked but not blocking start** — RunningHub provider object purge (no OpenAPI delete); historical public `s.` objects (plan before any purge); deeper custom-event DebugView chain enrichment; Preview isolation; audit-deletion operational proof.

## First data point (T0)

Captured at baseline start from the DebugView PASS session (same deploy `dpl_DvVoid3v8oESNyFQeKy1TdyjkoWn`):

| Metric | T0 value |
| --- | --- |
| Debug device | Google |
| Events in rolling 30 minutes | 12 |
| `page_view` | 6 |
| `user_engagement` | 4 |
| `first_visit` | 1 |
| `session_start` | 1 |
| Debug collect proof | `tid=G-VD6F0YDBQ5`, `ep.debug_mode=true`, `_dbg=1` |
| Screenshot set | `evidence/ga4-debugview-pass-20261030/` |

Week-0 GSC/GA4 aggregate export for the first complete reporting week after start is the next scheduled data point (Monday funnel review per `owners.md`). Until that export lands, weekly aggregate cells remain `NO DATA` rather than inferred from DebugView.

## Decision

**28-day baseline STARTED** at **2026-10-30 12:00 Asia/Shanghai**. Measurement gates for start are closed. P1 expansion remains blocked until end-of-window criteria pass.

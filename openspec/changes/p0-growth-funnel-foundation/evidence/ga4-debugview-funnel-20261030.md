# GA4 DebugView funnel evidence — 2026-10-30 (Asia/Shanghai)

Authority: t39u blanket verification budget.

Property `559043519` / stream `16131661294` / Measurement ID `G-VD6F0YDBQ5`.

## Method

Headless Chromium (Playwright) on the account-holder Mac visited production pages with `?debug_mode=1`:

- `/remove-background?debug_mode=1`
- `/pricing?debug_mode=1`
- `/remove-watermark?debug_mode=1`

Page screenshots: `evidence/ga4-debugview-20261030/{remove-background,pricing,remove-watermark}.png`.
Redacted network summary: `evidence/ga4-debugview-20261030/network-redacted.json`.

## What passed

| Check | Result |
| --- | --- |
| GA loader + `window.gtag` | **PASS** |
| Inline + React config `debug_mode: true` in `dataLayer` | **PASS** (see dataLayer tail with `gtag('config', 'G-VD6F0YDBQ5', {…, debug_mode:true})`) |
| `g/collect` HTTP **204** to `tid=G-VD6F0YDBQ5` | **PASS** |
| Client events observed on the wire | `page_view`, `tool_view`, plus synthetic `upload_started` / `upload_completed` / `paywall_viewed` |

## What failed / blocked (DebugView checkbox)

| Check | Result |
| --- | --- |
| Collect hits carry `_dbg=1` | **FAIL** — **0** hits with `_dbg=1` |
| Collect hits carry `ep.debug_mode=true` | Observed (ignored by DebugView per in-code comment in `components/analytics.tsx`) |
| Signed-in GA4 Admin **DebugView** UI screenshot | **NOT CAPTURED** (executor has no interactive Google Analytics console session / Vault Google login path in this turn) |
| Real UI signup → paywall → checkout click chain | **NOT DRIVEN** (synthetic `gtag('event', …)` only; no auth signup, no Stripe Checkout UI) |

## Verdict

**BLOCKED for the OpenSpec “Capture production GA4 DebugView … required event chain” checkbox.**

Network proof shows production instrumentation and `?debug_mode=1` config wiring, but DebugView ingestion is not evidenced because hits lack `_dbg=1` and the Admin DebugView UI was not opened. **Do not start the 28-day baseline** until `_dbg=1` is fixed/verified and a signed-in DebugView receipt (or equivalent) is attached.

## Follow-ups

1. Fix gtag so `debug_mode` becomes `_dbg=1` on `/g/collect` (not only `ep.debug_mode`).
2. Drive real tool upload UI + pricing CTA + signup/paywall under `?debug_mode=1`.
3. Capture signed-in DebugView screenshot for property `559043519`.

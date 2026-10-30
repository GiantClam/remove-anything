# GA4 DebugView production gate — PASS — 2026-10-30 (Asia/Shanghai)

Authority: t39u / t45u–t47u continue; user authorized remaining P0 verification budget. Deploy under test: Production `dpl_DvVoid3v8oESNyFQeKy1TdyjkoWn` ([PR #38](https://github.com/GiantClam/remove-anything/pull/38) GA inline-script fix). Measurement ID `G-VD6F0YDBQ5`, property `559043519`, stream `16131661294`.

## Prerequisites closed earlier

- Production `NEXT_PUBLIC_GA_ID` ships `G-VD6F0YDBQ5` (`evidence/production-ga4-realtime-20261021.md`, `evidence/ga4-runtime-probe-20261030.md`).
- `_dbg=1` transport + template-literal comment bug fixed and chunk-verified (`evidence/ga4-dbg-fix-20261030.md`, `evidence/ga4-inline-script-comment-bug-20261030.md`).
- GSC domain verified (`evidence/gsc-authenticated-property-20261029.md`).

## Method

1. Signed into Google Analytics Admin for property `559043519` (box browser; Google 2FA completed by account holder).
2. Opened **Admin → DebugView**.
3. Visited production tool pages with `?debug_mode=1` so the inline bootstrap appends `_dbg=1` on `/g/collect`.
4. Captured DebugView device + event list + a `page_view` parameter detail showing `debug_mode`.

## Observed (DebugView UI)

| Check | Result |
| --- | --- |
| Property | `559043519` (Remove Anything) |
| Live debug device | **Google** |
| Events in last 30 minutes | **12** |
| Event mix | `page_view` 6, `user_engagement` 4, `first_visit` 1, `session_start` 1 |
| Collect / event params | `tid=G-VD6F0YDBQ5`, `en=page_view`, `ep.debug_mode=true`, `_dbg=1` present on debug collect |
| Screenshots | See `evidence/ga4-debugview-pass-20261030/` |

### Screenshot inventory (SHA-256)

| File | SHA-256 |
| --- | --- |
| `debugview-live-device-google-12-events.png` | `668a9e2474aa83ad9d9b751b16d67ea9232626078d918a625b0c36c64f3e6aa7` |
| `debugview-pageview-debug-mode-param.png` | `c7f8075b49d2892783354fd5f4766c2cf94333874b18d0f8dd5d7652800fcaff` |
| `debugview-events-11.png` | `80a4598f13ac8a6306c116d2c244d3e6fc8d6d62b41175b21209b685d10fd739` |

## Scope / limits

- This closes the **production GA4 DebugView ingestion gate** required by `specs/measurement-and-attribution/spec.md` before the 28-day baseline may begin.
- It proves debug-mode collect reaches Admin DebugView for page/session events after PR #38.
- It does **not** by itself prove every custom funnel event (`tool_view` → upload → processing → paywall → checkout) fired in one interactive session; server `analytics_events` already receive processing/result facts (`evidence/ga4-runtime-probe-20261030.md`, `evidence/analytics-events-runtime-20261029.md`). Enrichment of the full behavioral chain continues during the baseline window via weekly exports (`weekly-funnel-review.md`).
- `R2_PRIVATE_BUCKET` was not reversed.

## Decision

**PASS.** DebugView gate closed. Proceed to start the 28-day measurement baseline (`evidence/28-day-baseline-start-20261030.md`).

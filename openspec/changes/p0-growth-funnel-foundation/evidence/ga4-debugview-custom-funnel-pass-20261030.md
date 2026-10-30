# GA4 DebugView custom funnel events — PASS — 2026-10-30 (Asia/Shanghai)

Authority: t48u continue residuals / follow-up. Closes the open row in `evidence/funnel-event-enrichment-20261030.md` ("Production DebugView UI screenshot of custom events"). Does **not** reverse `R2_PRIVATE_BUCKET` or Preview isolation. No secrets recorded.

Measurement ID `G-VD6F0YDBQ5`, property `559043519`, stream as previously recorded. Production under observation after funnel enrichment deploy `dpl_fCMBMv4D6R6LPt26g1V6BWcLRzqt` ([PR #41](https://github.com/GiantClam/remove-anything/pull/41) / receipt [#42](https://github.com/GiantClam/remove-anything/pull/42)); later Preview isolation cutover left Production private R2 intact ([#43](https://github.com/GiantClam/remove-anything/pull/43)).

## Method

1. Signed-in Google Analytics Admin → property `559043519` → **DebugView** (same session family as `ga4-debugview-pass-20261030.md`).
2. Exercised production marketing flows with `?debug_mode=1` so the inline bootstrap appends `_dbg=1` on `/g/collect`.
3. Captured DebugView **Top Events (last 30 minutes)** showing custom funnel vocabulary alongside automatic events.

## Observed (DebugView UI)

| Check | Result |
| --- | --- |
| Property | `559043519` (remove-anything) |
| Events in last 30 minutes | **58** |
| Automatic mix | `page_view` 31, `user_engagement` 17, `scroll` 1 |
| Custom funnel mix | `tool_view` **7**, `task_created` **1**, `homepage_tool_card_clicked` **1** |
| Timeline sample | `tool_view` @ 21:24:50; `task_created` @ 21:25:44 (Asia/Shanghai wall clock in UI) |
| Screenshot | `evidence/ga4-debugview-custom-funnel-pass-20261030/debugview-custom-events-20261030.png` |

### Screenshot inventory (SHA-256)

| File | SHA-256 |
| --- | --- |
| `debugview-custom-events-20261030.png` | `b1b4475cb8deffcee3a551cb041024e12c67c4eddbe316a7f605b64ffa4d418a` |

## Sora2 `tool_view` tracker verification (no code change this PR)

Hypothesis from the follow-up brief: `/sora2-video-watermark-removal` might still lack `ToolViewTracker`. **Already closed on main** in [PR #41](https://github.com/GiantClam/remove-anything/pull/41) (`app/[locale]/(marketing)/sora2-video-watermark-removal/page.tsx` mounts `<ToolViewTracker toolSlug="sora2-video-watermark-removal" locale={locale} />`).

Live Production RSC probe (Asia/Shanghai 2026-10-30, `Accept: text/x-component` on `/en/sora2-video-watermark-removal`):

| Check | Result |
| --- | --- |
| `ToolViewTracker` in RSC module graph | **present** |
| Serialized props | `toolSlug="sora2-video-watermark-removal"`, `locale="en"` |
| Deploy id on chunk query | `dpl_EVpXRZe3iLRj7H8B5Qq8s69Qb5aS` |
| Compare | `/en/remove-background` also references `ToolViewTracker` (parity) |

App-shell route `/app/sora2-video-watermark-removal` intentionally has no page-level tracker (same pattern as other app-shell tool pages; canonical `tool_view` is the marketing URL).

## Scope / limits

- Proves enriched **client** custom events (`tool_view`, `task_created`, `homepage_tool_card_clicked`) reach Admin DebugView after PR #41.
- Does **not** by itself close full signup→paywall→checkout→purchase GA4 export (still inside 28-day baseline + Monday funnel routine).
- Server `analytics_events` facts remain as previously evidenced; durable outbox/retry still open per `tasks.md`.
- `R2_PRIVATE_BUCKET` / Preview isolation **unchanged** by this docs PR.

## Decision

**PASS** for custom funnel DebugView receipt. Sora2 marketing `tool_view` tracker verified live; no additional deploy required for that gap.

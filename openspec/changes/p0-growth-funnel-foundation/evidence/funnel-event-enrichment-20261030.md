# Custom funnel-event enrichment — 2026-10-30

Authority: t48u. Continues measurement residual noted in `tasks.md` / DebugView PASS (`ga4-debugview-pass-20261030.md`): base `page_view` chain was proven; custom `tool_view` → checkout enrichment continues during the 28-day baseline.

## Code shipped this turn

1. **Sora2 marketing page** now mounts `ToolViewTracker` (`tool_slug=sora2-video-watermark-removal`) — previously missing vs the other five P0 tools.
2. **Background marketing client** (covers remove-background / transparent-png / white-background / change-background-color) emits:
   - `upload_started` / `upload_completed`
   - `task_created` / `task_succeeded` / `task_failed`
   - `download_clicked`
   with registry `tool_slug`, locale, auth flag, and `task_id` where applicable.
3. **remove-objects**, **remove-watermark**, **sora2-video-watermark-removal** emit `task_created` and terminal `task_succeeded` / `task_failed`.
4. Helper `lib/background-tool-analytics.ts` + unit test maps marketing variants → registry slugs.

Already wired (unchanged): `tool_view` on five image tools; `signup_started`; `paywall_viewed`; `checkout_started` / `upgrade_clicked`; server facts `processing_*` / `result_downloaded` / `purchase_*` / `order_created` / `credits_*` / `signup_completed`.

## Verification status

| Check | Status |
| --- | --- |
| Unit: variant → slug | covered by `tests/growth/background-tool-analytics.test.ts` |
| Production DebugView custom-event receipt after deploy | **pending deploy of this PR** — re-check `tool_view` / `task_created` with `?debug_mode=1` |
| Full signup→paywall→checkout→purchase GA4 export | remains open inside 28-day baseline + weekly funnel routine |

## Does not close

- Automatic durable-sink retry/outbox (`tasks.md` measurement item).
- Weekly production GA4/GSC export receipt (routine Monday).

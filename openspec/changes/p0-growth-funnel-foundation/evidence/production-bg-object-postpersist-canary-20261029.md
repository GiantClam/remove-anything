# Production free canary (post persist + pooler) — background + object — 2026-10-29 (Asia/Shanghai)

Scope: Production `https://www.remove-anything.com`. Sequential free/low-res only after persist hotfix (PR #12) + transaction pooler cutover. **Did not** enable `TASK_RETENTION_EXECUTE`, Stripe live checkout, or paid full-res unlock beyond existing free cap. Synthetic assets: `portrait_before.png` (400×400), `mask.png` (400×400). Fresh cookie jars per tool.

## Deploy under test

| Field | Value |
| --- | --- |
| Alias | `www.remove-anything.com` |
| Production READY head (at canary) | `dpl_4AQVqMqDfxMWp3oHKB87Ca9kwfrD` |
| Git SHA | `f37c8ba48cdc277a1877938ebac903c28d263fba` (merge PR #13 paid remove-background waiver; includes persist #12 + pooler redeploy lineage) |
| `TASK_RETENTION_EXECUTE` | production plain **`false`** (confirmed via Vercel env list before canary) |

Wall clock CST: background **23:28:01 → 23:28:41**; object **23:28:52 → 23:30:59**.

Prior watermark post-fix PASS (reference, not re-run this turn):
- Persist hotfix: `taskId=2115743351121866754` → R2 ZIP download 200
- Pooler: `taskId=2115753422769836034` → R2 ZIP download 200

## 1) Background removal — PASS

| Step | Result |
| --- | --- |
| Jar | `/workspace/canary/jars/bg-postpersist-232801.jar` |
| `POST /api/generate` multipart `image` | HTTP **200**, `taskId=2115828024200089601`, `taskRecordId=282`, `status=processing` |
| Principal cookie | set; jar retained |
| Poll `GET /api/task/{id}` | processing → **succeeded** (poll 4, ~36s) |
| Final outputs | `/api/download-background?taskId=…&preview=1` (**not** RunningHub / staging) |
| Provider/staging leak scan | **none** (`runninghub`, `remove-anything-storage-staging`, `rh-images`) |
| `GET /api/download-background?taskId=…` | HTTP **200**, `image/png`, **418,788** B, PNG **400×400**, `x-output-max-edge-px: 1024` |

## 2) Object removal — PASS

| Step | Result |
| --- | --- |
| Jar | `/workspace/canary/jars/obj-postpersist-232852.jar` |
| `POST /api/remove-objects/assets` image | HTTP **200** → `https://s.remove-anything.com/uploads/C0Q0ZaWyYc6s.png` |
| `POST /api/remove-objects/assets` mask | HTTP **200** → `https://s.remove-anything.com/uploads/zyY-uwV5I8iy.png` |
| `POST /api/remove-objects` JSON `authorizationConfirmed:true` | HTTP **200**, `taskId=2115828261333458946`, `recordId=47` |
| Poll `GET /api/remove-objects/{id}` | processing → **succeeded** (poll 14, ~2m) |
| Final `outputImageUrl` | `/api/download-object?taskId=…&preview=1` (**not** provider URL) |
| Provider/staging leak scan | **none** |
| `GET /api/download-object?taskId=…` | HTTP **200**, `image/png`, **395,635** B, PNG **400×400**, `x-output-max-edge-px: 1024` |

## Isolation / gates

| Check | Result |
| --- | --- |
| Production CDN host `s.remove-anything.com` on uploads | **PASS** |
| No staging bucket host in create/poll/download JSON | **PASS** |
| No raw RunningHub URL in succeeded poll bodies | **PASS** |
| Sequential only (no parallel creates) | **PASS** |
| `TASK_RETENTION_EXECUTE` left `false` | **PASS** |
| Stripe live checkout | **not** called |

## Summary

| Target | Result |
| --- | --- |
| Watermark (prior post-fix) | **PASS** (reference) |
| Background create→poll→download | **PASS** |
| Object create→poll→download | **PASS** |
| Private/proxy download (not provider URL) | **PASS** |

## Artifacts (box)

- Evidence: `/workspace/canary/production-bg-object-postpersist-canary-20261029.md`
- Jars: `jars/bg-postpersist-232801.jar`, `jars/obj-postpersist-232852.jar`
- Out: `bg2-*`, `obj2-*` under `/workspace/canary/out/`
- Mac copy: `openspec/changes/p0-growth-funnel-foundation/evidence/production-bg-object-postpersist-canary-20261029.md`

## Side notes (status at canary time → later same day)

| Item | Status at canary | Later same day (Asia/Shanghai) |
| --- | --- | --- |
| Production `STRIPE_WEBHOOK_SECRET` | Missing during this canary | **Configured** — see `evidence/stripe-production-webhook-20261029.md` (still no live purchase canary) |
| GSC authenticated property receipt | Open at canary | **Closed** — `evidence/gsc-authenticated-property-20261029.md` |
| `analytics_events` runtime | Observed for this canary window (table below) | Partial — signup/checkout chain + outage retry still open |


## analytics_events (same canary window, SELECT-only)

`task_id` stores **record id** (not RunningHub taskId).

| name | task_id (record) | tool_slug | created_at (UTC) |
| --- | --- | --- | --- |
| `result_downloaded` | 282 | remove-background | 2026-10-29 15:28:40.691 |
| `processing_completed` | 282 | remove-background | 2026-10-29 15:29:09.966 |
| `result_downloaded` | 47 | remove-objects | 2026-10-29 15:30:58.762 |

Runtime delivery for download/complete on these free canaries: **observed**. Full funnel chain (signup → paywall → checkout) + retry/recovery still open in tasks.md.

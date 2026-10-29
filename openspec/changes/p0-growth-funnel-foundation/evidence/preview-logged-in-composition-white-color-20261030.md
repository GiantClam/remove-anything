# Preview logged-in durable composition E2E — white-bg / change-color — 2026-10-30 (Asia/Shanghai)

Scope: **Preview** deployment `https://remove-anything-9cct2etn1-giantclams-projects.vercel.app` (staging DB) with minted NextAuth test session (`canary-composition-20261030` / `composition-canary-20261030@example.com`). Wall clock ≈ **00:12–00:20 CST**.

**Constraints honored:** no `FULL_OUTPUT_IMPLEMENTATION_ENABLED` flip; no `TASK_RETENTION_EXECUTE`; no other-tool `paidEnabled`; **no live Stripe charge**.

Raw machine JSON (redacted paths): agent box `/workspace/canary/composition-e2e-evidence-20261030.json`.

## Results summary

| Check | Result |
| --- | --- |
| Logged-in cutout `POST /api/generate` → poll → download | **PASS** |
| Durable composition white (`backgroundType=solid` `#FFFFFF`) | **FAIL** |
| Durable composition change-color (`backgroundType=color` `#3B82F6`) | **FAIL** |
| Anonymous composition create gate | **PASS** (401 Unauthorized) |
| Production GA4 loader on white/color pages (`G-VD6F0YDBQ5`) | **PASS** (script present; not DebugView) |
| GA4 DebugView / full behavioral chain | **NOT_RUN** |
| Durable `analytics_events` funnel for this canary user/task | **NONE** (0 rows) |
| Live Stripe charge | **NOT_ATTEMPTED** |

**Overall durable composition E2E: FAIL**

## Blocker

**Code:** `COMPOSITION_SOURCE_PRIVATE_R2_UNFETCHABLE`

Owned cutout is persisted to **private staging R2** (`*.r2.cloudflarestorage.com/remove-anything-storage-staging/...`). Unauthenticated GET returns HTTP **400** XML `InvalidArgument` / `Authorization`. Composition `assertOwnedCompositionSources` → `readTrustedRemoteImage` therefore returns **`IMAGE_FETCH_FAILED`** (400).

Task status API only exposes `/api/download-background?taskId=…&preview=1`. Alternate create probes:

| foregroundImageUrl shape | HTTP | code |
| --- | --- | --- |
| DB R2 absolute URL (owned) | 400 | `IMAGE_FETCH_FAILED` |
| Relative `/api/download-background?…` | 404 | `COMPOSITION_SOURCE_UNAVAILABLE` |
| Absolute Preview download URL | 400 | `INVALID_COMPOSITION_INPUT` (allowlist/ownership) |
| Anon empty body | 401 | Unauthorized |

No `background_compositions` rows for the canary user (`count=0`). PUT/result download never reached.

## Cutout path (PASS)

| Field | Value |
| --- | --- |
| `taskId` | `2115839115739226114` |
| `taskRecordId` | `26` |
| Poll | succeeded (4 polls) |
| Download | HTTP **200**, `image/png`, **418,804** B |
| DB `user_id` | `canary-composition-20261030` |
| DB `output_image_url` host | `*.r2.cloudflarestorage.com` (staging private) |
| Raw R2 GET | **400** XML Authorization |

## Session

Preview `/api/auth/session` → 200 with test user id/email (JWT mint via Preview `NEXTAUTH_SECRET` canary secret; user upserted on staging).

## Analytics (staging `analytics_events`, no live charge)

| Metric | Value |
| --- | --- |
| Total rows | 28 |
| Top names | `result_downloaded` 17, `processing_completed` 4, `processing_failed` 3, `order_created` 3, `purchase_completed` 1 |
| Rows for canary `user_id` / this `task_id` | **0** |

Composition create failures did not emit durable analytics for this principal. Historical rows show download/processing/order names only — **no** signup/paywall/checkout chain in this snapshot beyond prior Preview credit canary `order_created` / `purchase_completed`.

## GA4 / funnel evidence without live charges

Production HTML loader check (Measurement ID `G-VD6F0YDBQ5`):

| Path | HTTP | gtag / GA id |
| --- | --- | --- |
| `/` | 200 | present |
| `/white-background-maker` | 200 | present |
| `/change-background-color` | 200 | present |

This does **not** close DebugView realtime ingestion of the task→download→paywall→checkout chain (`tasks.md` item still open). No browser DebugView receipt captured this turn.

## Isolation

- Preview only for authenticated composition mutations; Production used only for public page GA loader smoke.
- Staging DB reads/upserts limited to canary user + evidence SELECTs.
- Secrets not recorded in this file.

## Follow-up (engineering; not done this turn)

Composition must accept an **owner-scoped** source (task id / private object key / short-lived signed read) instead of requiring a publicly fetchable absolute `outputImageUrl`, **or** task status must expose a server-fetchable owner URL that matches DB ownership checks. Until then, white-bg / change-color durable server composition remains blocked after private R2 persist.

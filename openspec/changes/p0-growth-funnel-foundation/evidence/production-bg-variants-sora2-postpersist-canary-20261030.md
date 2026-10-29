# Production free canary (post persist + pooler) — transparent / white / change-color / Sora2 + batch gate — 2026-10-30 (Asia/Shanghai)

Scope: Production `https://www.remove-anything.com`. Sequential free/low-res only after persist hotfix + transaction pooler. **Did not** enable `TASK_RETENTION_EXECUTE`, Stripe live checkout, `FULL_OUTPUT_IMPLEMENTATION_ENABLED`, or other paid tools. Synthetic assets: `portrait_before.png` (400×400), `sora2-e2e-test.mp4` (~2.0 MB). Fresh cookie jars per tool.

## Deploy under test

| Field | Value |
| --- | --- |
| Alias | `www.remove-anything.com` |
| Production READY | `dpl_H6mn1UibVsTaB9k6NZMAAxzr3mAc` |
| Git SHA | `d357fb24dbc7354455df578a021f4907be0fea2a` (docs PR #17 lineage; includes persist #12 + pooler) |
| `TASK_RETENTION_EXECUTE` | production plain **`false`** (Vercel env list, id `l2JNDwYLqZIw3iKa`) |

Wall clock CST: **00:00:45 → 00:05:27** (transparent → white → changecolor → batch/composition gates → Sora2).

## Smoke pages

| Path | HTTP |
| --- | --- |
| `/transparent-png-maker` | **200** |
| `/white-background-maker` | **200** |
| `/change-background-color` | **200** |
| `/batch-remove-background` | **200** |
| `/sora2-video-watermark-removal` | **200** |

## Shared backend note (transparent / white / change-color)

All three marketing variants create via **`POST /api/generate`** (registry tool `remove-background`) → poll `GET /api/task/{id}` → `GET /api/download-background?taskId=…`. White/color durable server composition (`POST /api/background-composition`) requires an authenticated owner; anonymous create returned **401**. Client-side white/color overlay is UI-only and was not claimed as a separate provider workflow.

## 1) Transparent PNG maker — PASS

| Step | Result |
| --- | --- |
| Jar | `jars/transparent-000045.jar` |
| `POST /api/generate` | HTTP **200**, `taskId=2115836280616214530`, `taskRecordId=283`, `status=processing` |
| Poll | processing → **succeeded** (poll 3) |
| Final outputs | `/api/download-background?taskId=…&preview=1` (not RunningHub / staging) |
| Download | HTTP **200**, `image/png`, **418,785** B, PNG **400×400** **RGBA**, `alpha_zero=64445`, `has_transparency=true`, `x-output-max-edge-px: 1024` |

## 2) White background maker — PASS (shared cutout path)

| Step | Result |
| --- | --- |
| Jar | `jars/white-000045.jar` |
| `POST /api/generate` | HTTP **200**, `taskId=2115836434941444097`, `taskRecordId=284` |
| Poll | **succeeded** (poll 4) |
| Download | HTTP **200**, PNG **400×400** RGBA, **418,788** B, private proxy, `x-output-max-edge-px: 1024` |
| Composition auth gate | anon `POST /api/background-composition` → **401** `Unauthorized` |

## 3) Change background color — PASS (shared cutout path)

| Step | Result |
| --- | --- |
| Jar | `jars/changecolor-000045.jar` |
| `POST /api/generate` | HTTP **200**, `taskId=2115836609063768065`, `taskRecordId=285` |
| Poll | **succeeded** (poll 4) |
| Download | HTTP **200**, PNG **400×400** RGBA, **418,788** B, private proxy, `x-output-max-edge-px: 1024` |

## 4) Batch remove-background — GATE CLOSED (no free path)

| Check | Result |
| --- | --- |
| Page `/batch-remove-background` | **200** |
| Anon `POST /api/batch-remove-background` | HTTP **401** `Not authenticated` |
| Registry | `batch-remove-background` `paidEnabled: false` (paid path not opened) |
| Live Stripe / paid batch create | **not** attempted |

## 5) Sora2 video watermark removal — PASS

| Step | Result |
| --- | --- |
| Jar | `jars/sora2-postpersist-000303.jar` |
| `POST /api/sora2-video-watermark-removal-r2` | HTTP **200**, `taskId=2115836833224163329`, `recordId=272` |
| Upload | production R2 key under `…/remove-anything/uploads/…` (**not** staging) |
| Poll `GET /api/sora2-video-watermark-removal/{id}?dbOnly=false` | **succeeded** (poll 14, ~2m) |
| Final `imageUrl` | `/api/download?type=sora2-video-watermark-removal&taskId=…&preview=1` |
| Download | HTTP **200**, `video/mp4`, **1,621,363** B, BMFF `ftypqt` |

## Isolation / gates

| Check | Result |
| --- | --- |
| No staging bucket host in create/poll/download JSON | **PASS** |
| No raw RunningHub URL in succeeded poll bodies | **PASS** |
| Sequential only | **PASS** |
| `TASK_RETENTION_EXECUTE` left `false` | **PASS** |
| Stripe live checkout | **not** called |
| `FULL_OUTPUT` / other paid tools | **not** enabled |

## Summary

| Target | Result |
| --- | --- |
| Transparent create→poll→RGBA download | **PASS** |
| White create→poll→download (shared `/api/generate`) | **PASS** |
| Change-color create→poll→download (shared `/api/generate`) | **PASS** |
| Batch free path | **N/A** — auth/paid gate closed (**401** anon; `paidEnabled:false`) |
| Sora2 create→poll→mp4 download | **PASS** |
| Private/proxy download (not provider URL) | **PASS** |

## Artifacts (box)

- Evidence: `/workspace/canary/production-bg-variants-sora2-postpersist-canary-20261030.md`
- Summary JSON: `/workspace/canary/out/bg-variants-summary-000045.json`
- Log: `/workspace/canary/out/bg-variants-run.log`
- Jars: `transparent-000045`, `white-000045`, `changecolor-000045`, `sora2-postpersist-000303`
- Out: `transparent-*`, `white-*`, `changecolor-*`, `sora2-000303-*`

## Remaining (unchanged blockers)

- Authenticated durable composition E2E for white/change-color (anon composition correctly 401)
- Batch paid path still closed pending cost approval
- Production live Stripe Checkout canary still not run (no live charge this turn)
- Retention execute / 90-day audit physical deletion still closed
- GA4 full behavioral chain / DebugView; 28-day baseline not started

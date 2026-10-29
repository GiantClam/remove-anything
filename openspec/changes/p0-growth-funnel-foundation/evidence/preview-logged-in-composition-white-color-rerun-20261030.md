# Preview logged-in durable composition E2E — white-bg / change-color — 2026-10-30 rerun (Asia/Shanghai)

Scope: **Preview** deployment `https://remove-anything-pz6gnfsu0-giantclams-projects.vercel.app` (`dpl_7JhtL8mtQ1TReuxSM8V9bALLF19j`, branch `codex/p0-growth-funnel-foundation-preview` carrying cherry-picked private-R2 composition fix `525943f`; staging DB + canary JWT). Wall clock ≈ **00:42–00:43 CST**.

**Code under test also on PR branch** `fix/composition-private-r2-source-read` → [PR #19](https://github.com/GiantClam/remove-anything/pull/19) (same commits; Preview canary used the staging-secret branch because shared Preview lacked staging `R2_*` / `DATABASE_URL`).

**Constraints honored:** no `FULL_OUTPUT_IMPLEMENTATION_ENABLED` flip; no `TASK_RETENTION_EXECUTE`; no other-tool `paidEnabled`; **no live Stripe charge**.

Raw machine JSON (local canary secrets dir, not committed): `.canary-secrets/composition-e2e/evidence-rerun.json`.

## Results summary

| Check | Result |
| --- | --- |
| Logged-in cutout `POST /api/generate` → poll → download | **PASS** |
| Durable composition white (`backgroundType=solid` `#FFFFFF`) via private R2 URL | **PASS** (`id=1`) |
| Durable composition change-color (`backgroundType=color` `#3B82F6`) via private R2 URL | **PASS** (`id=2`) |
| Durable composition via relative `/api/download-background?taskId=…` | **PASS** (`id=3`) |
| Anonymous composition create gate | **PASS** (401 Unauthorized) |
| PUT composition result (private result storage) | **PASS** |
| Composition history for canary user | **PASS** (total=3) |
| Raw private R2 bare GET still denied | **PASS** (HTTP 400 Authorization) |

**Overall durable composition E2E: PASS**

## Fix verified

`COMPOSITION_SOURCE_PRIVATE_R2_UNFETCHABLE` / `IMAGE_FETCH_FAILED` cleared by:

1. `readTrustedImageAllowingPrivateR2` — owner-scoped short-lived signed GET for private R2 cutouts
2. Resolve owner `/api/download-background?taskId=` preview URLs to durable private `outputImageUrl` before ownership + decode
3. Bucket remains private (raw GET still 400)

## Cutout path (PASS)

| Field | Value |
| --- | --- |
| `taskId` | `2115846852804038657` |
| `taskRecordId` | `28` |
| Poll | succeeded (5 polls) |
| Download | HTTP **200**, `image/png`, **418,801** B |
| DB `user_id` | `canary-composition-20261030` |
| DB `output_image_url` host | `9630806d5a588fc350ee64c395005cfa.r2.cloudflarestorage.com` (staging private) |

## Session

Preview `/api/auth/session` → 200 with test user id/email (JWT mint via branch `NEXTAUTH_SECRET` canary secret; user upserted on staging).

## Isolation

- Preview only for authenticated composition mutations
- Staging DB reads/upserts limited to canary user + evidence SELECTs
- Secrets not recorded in this file
- No FULL_OUTPUT / retention execute / live charge / other paid tools

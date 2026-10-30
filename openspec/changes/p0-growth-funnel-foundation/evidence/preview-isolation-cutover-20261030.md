# Default Preview isolation cutover — 2026-10-30 (Asia/Shanghai)

Authority: t48u continue residuals. **No secrets recorded. Production `R2_PRIVATE_BUCKET` left as `remove-anything-private`. No historical public R2 deletes.**

## Goal

Stop **default** (non-branch-override) Preview deployments from using production R2 bucket names, production GA4 measurement ID, and production RunningHub API key.

## Pre-state (from `preview-isolation-status-20261030.md`)

- Branch `codex/p0-growth-funnel-foundation-preview` already had staging-oriented overrides.
- Shared triple-target (`development,preview,production`) still supplied production `R2_BUCKET=remove-anything`, `R2_URL_BASE=https://s.remove-anything.com`, `NEXT_PUBLIC_GA_ID`, and `RUNNINGHUB_API_KEY` to default Preview.

## Credential probe (read/write probe objects deleted immediately)

| Credential set | staging public/private | prod public `remove-anything` | prod private `remove-anything-private` |
| --- | --- | --- | --- |
| Vercel **Preview** `R2_ACCESS_KEY` / `R2_SECRET_KEY` (no branch) | PUT/HEAD/DELETE **200/204** | **403 AccessDenied** | **403 AccessDenied** |
| Vercel **Production** R2 keys | 200/204 | 200/204 | 200/204 |

Conclusion: default Preview object credentials were already staging-scoped; the remaining leak was **bucket name / URL base / GA / RH** inherited from shared triple-target envs.

## Vercel env changes (names only)

Created Preview-only (no `gitBranch`):

| Key | Value (non-secret) |
| --- | --- |
| `R2_BUCKET` | `remove-anything-storage-staging` |
| `R2_PRIVATE_BUCKET` | `remove-anything-storage-staging-private` |
| `R2_URL_BASE` | `https://9630806d5a588fc350ee64c395005cfa.r2.cloudflarestorage.com/remove-anything-storage-staging` |

Narrowed shared entries by removing `preview` from `target` (kept production + development):

| Key | Notes |
| --- | --- |
| `R2_BUCKET` | remains `remove-anything` for Production/Development |
| `R2_URL_BASE` | remains `https://s.remove-anything.com` for Production/Development |
| `NEXT_PUBLIC_GA_ID` | Production/Development only — default Preview no longer loads prod GA4 |
| `RUNNINGHUB_API_KEY` | Production/Development only — default Preview cannot spend prod RH coins |

Unchanged:

- Production `R2_PRIVATE_BUCKET=remove-anything-private`
- Existing Preview `R2_ACCESS_KEY` / `R2_SECRET_KEY` (staging-scoped)
- Shared `R2_ACCOUNT_ID` / `R2_ENDPOINT` / `R2_REGION` (same Cloudflare account; bucket identity is the isolation boundary)

## Preview redeploy for verification

- Forced Preview deploy from `main` @ `9f74c69…`: **`dpl_28X8dPVFAyRbQ6LT99yUcVDTppWP`** READY
- URL host: `remove-anything-4lq4nhrvk-giantclams-projects.vercel.app`
- Target: Preview (`target=null`)

### Upload probe (PASS) — Asia/Shanghai 2026-10-30 12:24

`POST /api/remove-objects/assets` with Deployment Protection bypass:

| Check | Result |
| --- | --- |
| Upload HTTP | **200** |
| Locator host | `9630806d5a588fc350ee64c395005cfa.r2.cloudflarestorage.com` (not `s.remove-anything.com`) |
| Locator path includes staging bucket | **yes** |
| HEAD staging-private | **200** (object present) |
| HEAD staging-public | **404** |
| HEAD prod public `remove-anything` | **404** |
| HEAD prod private `remove-anything-private` | **404** |
| Prod GA id `G-VD6F0YDBQ5` in Preview HTML | **absent** |
| Default Preview env pull `R2_BUCKET` | `remove-anything-storage-staging` |
| Default Preview env pull `RUNNINGHUB_API_KEY` / `NEXT_PUBLIC_GA_ID` | **absent** (removed from Preview targets) |

Machine JSON: `preview-isolation-verify-20261030.json`.

Production latest deploy unchanged this cutover (`dpl_5wBDh9FmirkXJM4w6j6U74ozrifw` READY). Production `R2_PRIVATE_BUCKET` still `remove-anything-private`.

Generate on default Preview returned HTTP 500 (`a._.$transaction is not a function`) before provider work — consistent with incomplete default Preview DB wiring (residual below), not a production RH spend.


## Hard blockers / residuals (documented, not closed)

1. **Dedicated RunningHub Preview key** — not provisioned. Default Preview now fails closed (no prod key). Provider canaries on default Preview need a separate RH test account/key + budget.
2. **Dedicated GA4 Preview stream** — not provisioned. Default Preview simply omits `NEXT_PUBLIC_GA_ID` (no pollution). Optional later: create a staging GA4 property/stream and set Preview-only `NEXT_PUBLIC_GA_ID`.
3. **Default Preview database** — still may resolve via shared Supabase/Vercel integration for non-override branches. Branch `codex/p0-growth-funnel-foundation-preview` keeps isolated `DATABASE_URL`. Full DB isolation for *all* Preview branches remains open.
4. **Production R2 token still has staging write** — prod keys can write staging buckets. Isolation relies on Preview using staging-only keys (confirmed 403 on prod buckets) + Preview `R2_BUCKET` names. Optional later: mint staging-only token for Preview and revoke staging from the production token.

## Related inventory

Read-only public bucket count (no deletes): `historical-public-s-objects-inventory-count-20261030.json` / companion md.

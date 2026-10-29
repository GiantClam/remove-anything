# Production private R2 cutover — 2026-10-30 (Asia/Shanghai)

Authority: t39u budget continue. Historical public objects were **not** deleted.

## Cloudflare bucket

| Field | Value |
| --- | --- |
| Name | `remove-anything-private` |
| Created | `2026-10-29T17:39:25.032Z` (UTC) ≈ **2026-10-30 01:39 CST** |
| Location | APAC / Standard |
| `r2.dev` managed public URL | **disabled** (`enabled: false`) |
| Custom domains | **none** |

Account: Cloudflare account that already owns `remove-anything` + staging pair.

## Vercel Production env

| Key | Action |
| --- | --- |
| `R2_PRIVATE_BUCKET` | Set to `remove-anything-private` (Production) |

Same account-scoped R2 access keys already on Production are used (no new token minted in chat).

## Application behavior after cutover

- New task outputs (`persistRunningHubOutput`) and new `uploadToR2` objects write to **`R2_PRIVATE_BUCKET`** via `putPrivateItemInBucket` (no public ACL).
- DB locators still use `R2_URL_BASE` (`https://s.remove-anything.com/...`) so `getR2ObjectKey` keeps working.
- Download routes fetch via `fetchTaskOutputByKey`: **private bucket first**, then legacy public bucket for historical keys.
- Composition continues to require dedicated `R2_PRIVATE_BUCKET` ≠ `R2_BUCKET` (unchanged contract).
- Retention deletes attempt **both** buckets for each key.

## Historical public objects

| Action | Status |
| --- | --- |
| Blind delete of `s.remove-anything.com` objects | **NOT DONE** |
| Rewrite of historical DB URLs | **NOT DONE** |
| Disable custom domain on public `remove-anything` bucket | **NOT DONE** (would break samples/blog/CDN assets and historical downloads until migrated) |

Documented residual risk: anonymous GETs to existing keys on `s.remove-anything.com` remain possible until a separate orphan-key / CDN migration. **New** processed/upload keys after this cutover should 404 on the public CDN because they exist only in `remove-anything-private`.

## Verification checklist (post-deploy)

1. Canary create watermark/background → DB locator host still `s.remove-anything.com` (key shape).
2. Anonymous GET of that locator path on public CDN → **404**.
3. Authenticated `/api/download*` → **200**.
4. Composition create still succeeds with private bucket.

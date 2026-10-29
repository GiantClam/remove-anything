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

## Deploy

- Bucket create + env set before merge; Production READY after buildfix: `dpl_J4ShAaybYfai8wTHWBydB3Z434rq` (commit `296d6f1`, aliases include `www.remove-anything.com`).
- Code: [PR #25](https://github.com/GiantClam/remove-anything/pull/25), [PR #26](https://github.com/GiantClam/remove-anything/pull/26).

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

## Cutover attempt result (same day)

1. Code merged ([PR #25](https://github.com/GiantClam/remove-anything/pull/25) / buildfix [#26](https://github.com/GiantClam/remove-anything/pull/26)) and Production briefly had `R2_PRIVATE_BUCKET=remove-anything-private`.
2. App writes then failed with S3 **`Access Denied`** on upload/generate (`/api/remove-objects/assets`, `/api/generate`) — Production `R2_ACCESS_KEY` / secret appear **bucket-scoped** to the public `remove-anything` bucket and do not authorize the new private bucket.
3. **Hotfix:** Production `R2_PRIVATE_BUCKET` cleared to empty + redeploy `dpl_GAXC5DGGqutXRTc8BfZzC6N7Cu2N` READY. Upload smoke **HTTP 200** again (`https://s.remove-anything.com/uploads/…` public locator).
4. Cloudflare bucket `remove-anything-private` **still exists**, `r2.dev` disabled, **no custom domain**, object list empty. **Historical public objects were not deleted.**

### Unblock to finish private cutover

Account holder must expand the Production R2 API token (or mint a new Object Read & Write token) to include **`remove-anything-private`**, then set Production `R2_PRIVATE_BUCKET=remove-anything-private` and redeploy. Do not re-enable until a tiny upload returns 200 and anonymous CDN GET of the new key is 404 while `/api/download*` works.


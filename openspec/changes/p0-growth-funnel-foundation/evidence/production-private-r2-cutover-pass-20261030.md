# Production private R2 cutover — PASS (2026-10-30, Asia/Shanghai)

Authority: t46u RH coins topped up; t39u/t45u continue. **Historical public R2 objects were not deleted.** Secrets not recorded.

## 0) Balance unlock

| Check | Result |
| --- | --- |
| Production `RUNNINGHUB_API_KEY` vs `.env.local` | Same fingerprint |
| `POST /uc/openapi/accountStatus` | `remainCoins: 5100`, `remainMoney: 71.5220` CNY, `apiType: NORMAL` |
| Prior blocker | `NOT_ENOUGH_BALANCE` → fixed by top-up; error mapping shipped in [PR #29](https://github.com/GiantClam/remove-anything/pull/29) / `dpl_J3gCscRwnWFxV8usfgW9iRV3xpc5` |

## 1) Public-bucket generate canary (before cutover)

`R2_PRIVATE_BUCKET` was empty. Deploy under test: `dpl_J3gCscRwnWFxV8usfgW9iRV3xpc5` (www aliases).

| Step | Result |
| --- | --- |
| `POST /api/generate` | HTTP **200**, `taskId=2115993019269472257`, `taskRecordId=294`, `status=processing` |
| Poll `GET /api/task/{id}` | **succeeded** (poll 3) |
| `GET /api/download-background?taskId=…&preview=1` | HTTP **200**, `image/png`, **418,788** B, PNG **400×400**, `x-output-max-edge-px: 1024` |

**Verdict: PASS** on public bucket.

## 2) Private cutover

| Action | Value |
| --- | --- |
| Production env | `R2_PRIVATE_BUCKET=remove-anything-private` (id `FaXlYKsm8k5ldSHf`, comment t46u) |
| Redeploy | `dpl_8MP5aZETAgx2erNfVTNHr8fFL82G` READY, aliases include `www.remove-anything.com`, SHA `af3811a` |
| Prod R2 token private RW | Pre-cutover probe **OK** (same fingerprint as cutover canary token) |

## 3) Post-cutover verification

### Generate + download (anon principal)

| Step | Result |
| --- | --- |
| `POST /api/generate` | HTTP **200**, `taskId=2115994651210244098`, `taskRecordId=295` |
| Poll | **succeeded** |
| Download preview | HTTP **200**, PNG **418,793** B |
| DB locators | host still `s.remove-anything.com` (key shape) |
| Input key HeadObject | **private: yes** / public: NotFound |
| Output processed key HeadObject | **private: yes** / public: NotFound |
| Anonymous CDN GET of those keys | **404** |

### Assets upload

| Step | Result |
| --- | --- |
| `POST /api/remove-objects/assets` (`file` field) | HTTP **200**, locator `s.remove-anything.com/uploads/…` |
| HeadObject | **private: yes** / public: NotFound |
| Anonymous CDN GET | **404** |

### Composition (authenticated + anon gate)

User `canary-private-r2-20261030` (minted NextAuth session). Cutout task `2115995198751473665` / record `296` succeeded; foreground locator on private bucket via `s.remove-anything.com` host.

| Step | Result |
| --- | --- |
| Composition `solid` `#FFFFFF` from private R2 URL | HTTP **200**, composition id **1** |
| Composition `color` `#3B82F6` from private R2 URL | HTTP **200**, composition id **2** |
| Composition from relative `/api/download-background?…` | HTTP **200**, composition id **3** |
| Anon composition create | HTTP **401** Unauthorized |

## Overall

**PASS** — generate works after RH top-up; private bucket cutover holds for upload, generate persist, download, and authenticated composition; CDN remains closed for new keys. Historical public objects untouched.

# Production private R2 re-check after token scope update — 2026-10-30 (Asia/Shanghai)

Authority: t45u (user expanded Cloudflare R2 token `remove-anything` with Object Read & Write on `remove-anything-private`). No secrets recorded. No historical public objects deleted.

## 1) Credential check (direct S3 API, test key under `canary/`)

| Op on `remove-anything-private` | Result |
| --- | --- |
| PUT | 200 |
| GET | 200 |
| DELETE | 204 |

Token scope blocker from `production-private-r2-cutover-20261030.md` is **resolved**.

## 2) Cutover attempt

- 09:59 CST: Production `R2_PRIVATE_BUCKET=remove-anything-private`; redeploy `dpl_FLPhCNKkP5c2yNbSahv7dDpvFz17` READY.
- `POST /api/remove-objects/assets` → **200**, `uploads/v-71CUsdBmFC.png`.
  - HEAD in `remove-anything-private`: 200 (254,139 B); HEAD in `remove-anything`: 404.
  - Anonymous `s.remove-anything.com` GET: **404** (no public exposure). PASS.
- `POST /api/generate` (remove-background) at 10:02 and 10:07 CST → `TASK_CREATION_OUTCOME_UNKNOWN` (records 291, 292). The R2 input upload succeeded before the provider call.

## 3) Rollback + isolation

- 10:08 CST: `R2_PRIVATE_BUCKET` cleared; redeploy `dpl_MtAhpqWGxMtwbBxzy1EBBD1VunH7` READY.
- Upload → 200, public CDN GET 200 (legacy path restored).
- `POST /api/generate` at 10:10 CST on the **public** bucket → still `TASK_CREATION_OUTCOME_UNKNOWN` (record 293).

**Conclusion:** the generate failure comes from the RunningHub create call and does not depend on which bucket is used. Bucket permissions are fixed. Production has been left on the public bucket until the provider recovers. Then re-set `R2_PRIVATE_BUCKET`, redeploy, and re-run generate → poll → download plus composition.

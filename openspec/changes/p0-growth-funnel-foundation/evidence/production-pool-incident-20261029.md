# Production pool incident recovery — 2026-10-29 (Asia/Shanghai)

## Root cause (one sentence)
Supabase **session-mode** pool (`pool_size: 15`) was exhausted (`EMAXCONNSESSION`) because `/api/cron/cleanup-tasks` dry-run still ran heavy Prisma `COUNT(*)` every 15 minutes and held idle Supavisor backends; task status streams then timed out at 30s. **Not** caused by GA4 PR #10 / `f827f6e`.

## Immediate relief
1. Terminated stale idle Supavisor backends whose last query was retention `COUNT(*)` / long `DISCARD ALL` (multiple rounds).
2. Hotfix [PR #11](https://github.com/GiantClam/remove-anything/pull/11) merged as `0326591`:
   - Removed `cleanup-tasks` from `vercel.json` `crons` (left `process-queue` `*/1`).
   - Early-return in `app/api/cron/cleanup-tasks/route.ts` unless `TASK_RETENTION_CRON_ENABLED=true`.
   - Execution remains blocked (`TASK_RETENTION_EXECUTE` / `RETENTION_EXECUTION_BLOCKED`).
3. Production deploy **READY**: `dpl_7wMPLfo2Kahs3bFudM4rbWbmfEWq` @ `0326591` (aliases include `www.remove-anything.com`).

## Pool after relief
- Before: ~19 backends / session pool full; cleanup cron logging repeated `EMAXCONNSESSION`.
- After terminate + hotfix: ~7 Supavisor `postgres` backends observed; creates return HTTP 200 again.

## Sequential free-path canary (production, cookie jars)

Wall clock approx **17:12–17:33 CST (Asia/Shanghai)** on deploy `dpl_7wMPLfo2…`. Synthetic assets only. No Stripe / no retention execute / sequential creates only.

| Tool | Create | Provider (RunningHub) | App poll / persist | Download |
| --- | --- | --- | --- | --- |
| Background | **PASS** HTTP 200 `taskId=2115733518440169474` `recordId=279`; retry `2115734111653163009` / `280` | SUCCESS (approved `rh-images-tos.xiaoyaoyou.com/.../output/`) | **FAIL** timed out @120s → `Processing timed out` | n/a |
| Watermark | **PASS** HTTP 200 `taskId=2115734696104263682` `taskRecordId=5` | SUCCESS | **FAIL** `processing` + `The result could not be stored yet`; row briefly had **raw provider URL** in `output_zip_url` (not R2) | **FAIL** |
| Object | **PASS** assets 200 + create 200 `taskId=2115736019772076033` `recordId=46` | SUCCESS (2 PNGs, prefix match OK) | **FAIL** `The result could not be stored yet. Please retry shortly.` | n/a |

### Canary verdict
- **Pool create path: recovered** (HTTP 200 creates; cleanup cron disabled).
- **End-to-end canary: FAIL** — provider finishes, private R2 persist on Vercel poll path fails. Same-day morning free-core canary had passed, so this is a **second concurrent failure mode**.

## Recommended follow-up (priority)
1. **Switch production `DATABASE_URL` to transaction pooler `:6543`** with `pgbouncer=true` (Prisma already adds `pgbouncer=true` + `connection_limit=1` for 6543 in `db/prisma.ts`). Session mode pool_size 15 is too tight for Vercel + `process-queue`.
2. **Fix R2 persist on poll** (`persistRunningHubOutput` / watermark+object status routes): provider URL + `RUNNINGHUB_OUTPUT_URL_PREFIXES` match; check Vercel→provider fetch, R2 `ACL: private` vs bucket ownership (`putPrivateItemInBucket`), and function duration. Do not leave raw provider URLs in `output_*` columns.
3. Keep `TASK_RETENTION_CRON_ENABLED` unset; **do not** enable `TASK_RETENTION_EXECUTE` until retention race + pooler migration are done.
4. Re-run sequential free-core canary after persist fix.

## Gates untouched
- No Stripe / paid checkout
- No retention deletes
- No parallel DB creates during this canary

## Persist / provider-URL follow-up — 2026-10-29 ~17:50 CST (Asia/Shanghai)

### Root cause
1. `/api/cron/process-queue` wrote raw RunningHub `fileUrl` into `output_zip_url` / `output_image_url` and marked `succeeded`, racing the poll path (watermark id=5 ended as `succeeded` + PROVIDER URL + store error).
2. Poll persist catch paths could leave non-R2 URLs in `output_*` after a failed migration.
3. Local repro showed `persistRunningHubOutput` itself works (~2s) with production R2 + approved prefix `https://rh-images-tos.xiaoyaoyou.com/.../output/`; ACL put also works. Failure mode in production was the queue race / incomplete migration, not missing R2 credentials.

### Fix
- [PR #12](https://github.com/GiantClam/remove-anything/pull/12) merged as `b038d7b`:
  - `process-queue` migrates via `persistRunningHubOutput` only; never stores provider URLs; clears `output_*` and stays `processing` on persist failure.
  - Poll routes clear non-R2 outputs on persist failure; status `maxDuration` 60s.
  - Persist uses `putPrivateItemInBucket` (no canned ACL).
- Manual repair of watermark id=5 to private R2 key under `watermark-removal/processed/` (provider URL removed).

### Deploy
- Production **READY**: `dpl_9XxEku5UqcWt5XrnPogyEzz1wUiH` @ `b038d7b` (aliases include `www.remove-anything.com`).

### Sequential free canary (watermark)
| Step | Result |
| --- | --- |
| Create | HTTP 200 `taskId=2115743351121866754` `taskRecordId=6` |
| Poll | `succeeded`; client output `/api/download?type=watermark-removal&taskId=2115743351121866754` (APP path, not provider) |
| DB | `output_zip_url` kind **R2** (`https://s.remove-anything.com/watermark-removal/processed/...`) |
| Download | HTTP **200**, `application/zip`, ZIP magic `PK\x03\x04`, size 21119 |

**Verdict: PASS** end-to-end (create → private R2 persist → downloadable result). No Stripe / no retention execute / sequential only.

## Transaction pooler cutover — 2026-10-29 ~18:30 CST (Asia/Shanghai)

### Change
- Production Vercel `DATABASE_URL` (id `eo3sg6yAd4iSKjyV`) upserted to Supabase **transaction** pooler:
  - host `aws-0-us-east-1.pooler.supabase.com`
  - port **`6543`**
  - query flags: `pgbouncer=true`, `sslmode=require`
  - user shape `postgres.ofmwvapsmsokwvqhwhtf` (password not recorded)
- Production `DIRECT_URL` created (id `FYX0irMhSmacIgAU`): host `db.ofmwvapsmsokwvqhwhtf.supabase.co` port **5432** `sslmode=require` (Prisma `directUrl`).
- Prior production `DATABASE_URL` was session-mode pooler **`:5432`** (EMAXCONNSESSION / pool_size 15); sensitive value was not listable via decrypt APIs before upsert.
- `db/prisma.ts` already special-cases pooler host + port `6543` to ensure `pgbouncer=true` and `connection_limit=1`.
- **Not** enabled: `TASK_RETENTION_EXECUTE` remains `false`; retention cron stays off; no paid/Stripe changes.

### Deploy
- Redeploy of `b038d7b` (PR #12 code unchanged): **`dpl_2yEqfwdGLkTcsPE57GyXHqktGDMN`** READY; aliases include `www.remove-anything.com`.

### Sequential free canary (watermark)
| Step | Result |
| --- | --- |
| Smoke `/`, `/remove-watermark`, `/api/task-queue/status` | HTTP 200 |
| Create `POST /api/watermark-removal` | HTTP **200** `taskId=2115753422769836034` `taskRecordId=7` (no EMAXCONNSESSION) |
| Poll | processing → **succeeded** (~40s, poll 8) |
| Client output | `/api/download?type=watermark-removal&taskId=…` (app path, not provider) |
| Download | HTTP **200**, ZIP magic `PK\x03\x04`, size 395158 |

**Verdict: PASS** create→poll→download on transaction pooler. No Stripe / no retention execute / sequential only.

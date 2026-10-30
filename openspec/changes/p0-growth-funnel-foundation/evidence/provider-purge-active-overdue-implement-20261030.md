# Provider overdue cancel implement + canary — 2026-10-30 (Asia/Shanghai)

Authority: t39u / t46u continue. Private R2 cutover left in place (`R2_PRIVATE_BUCKET` unchanged).

## Code

- [PR #31](https://github.com/GiantClam/remove-anything/pull/31): `TASK_RETENTION_CANCEL_ACTIVE_OVERDUE` (default off) + grace; RunningHub `cancelTask`; CAS → `canceled`; URLs kept for later R2 scrub. Cancel code `807` treated as success.
- Follow-up reconcile PR (this commit): treat cancel `817` as success; status-probe reconcile for provider `SUCCESS`/`FAILED`; force-cancel local rows whose provider id is not a RunningHub decimal id (legacy Replicate / placeholders).

## Provider file purge

**Still unavailable.** RunningHub OpenAPI exposes cancel/upload/status/outputs only — no delete for `rh-images.*`. `unresolvedExternal` remains expected until provider documents a purge API. No unauthenticated CDN DELETE attempted. No historical public R2 orphan purge in this change.

## Production enablement

- Env (Production): `TASK_RETENTION_CANCEL_ACTIVE_OVERDUE=true`, `TASK_RETENTION_ACTIVE_OVERDUE_GRACE_MS=21600000` (6h).
- Redeploy after env: `dpl_B9MP9ichXE4HKpzBdWp6xv317eGU` (www alias).
- Note: `www.remove-anything.com` returned Cloudflare 1010 from the operator Mac IP; canary used the deployment URL with protection bypass.

## Canary 1 (pre-reconcile) — authenticated GET `/api/cron/cleanup-tasks`

Observed at 2026-10-30 ~10:51 Asia/Shanghai.

| Field | Value |
| --- | --- |
| dryRun / executionEnabled | false / **true** |
| cancelActiveOverdueEnabled | **true** |
| activeOverdueGraceMs | 21600000 |
| batchSize | 20 |
| scanned / due | 60 / 60 |
| **expired** | **21** |
| **filesDeleted** | **46** |
| **canceledActive** | **11** |
| cancelFailures | 12 |
| failures (R2) | **0** |
| unresolvedExternal | 40 (`rh-images.xiaoyaoyou.com` 38, `rh-images-tos…` 2) |
| sharedReferences | 7 |
| activeBlockers | 13 |
| auditTrimmed | 6 |

### Cancel failure root cause (probe)

- Legacy `taskData.replicateId` values are non-numeric Replicate-era ids → RH API `301 taskId must be positive`.
- Some `backgroundRemovalTask` rows still `processing` in DB while provider status is already `SUCCESS`; cancel returns `817 APIKEY_TASK_CANCEL_NOT_ALLOWED`.
- At least one `objectRemovalTask` had a non-numeric placeholder provider id.

## Verdict

- **PASS** for flagged overdue cancel path + continued bounded R2 execute (0 R2 failures).
- **PARTIAL** until reconcile follow-up ships for legacy/invalid ids and SUCCESS-stuck rows.
- Provider object purge: **open / blocked on vendor API**.
- Do **not** start 28-day baseline until GA4 DebugView gate is also closed (still needs Google sign-in).

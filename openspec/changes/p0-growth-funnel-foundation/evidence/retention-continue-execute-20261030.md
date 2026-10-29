# Retention continue (bounded execute) — 2026-10-30 (Asia/Shanghai)

Authority: t39u. Continues after `evidence/retention-execute-bounded-20261030.md`.

## Call

Authenticated `GET https://www.remove-anything.com/api/cron/cleanup-tasks` with Production `CRON_SECRET`. Live env already had `TASK_RETENTION_EXECUTE` + cron enabled (batch 20).

## Aggregate (no URLs/keys)

| Field | Value |
| --- | --- |
| dryRun / executionEnabled | **false / true** |
| batchSize | 20 |
| scanned / due | 60 / 60 |
| **expired** | **22** |
| **filesDeleted** | **50** |
| **auditTrimmed** | **2** |
| failures | **[]** (0) |
| unresolvedExternal | 52 |
| sharedReferences | 5 |
| activeBlockers | 36 |

### Blocker breakdown (safe)

- `unresolvedExternal` hosts: `rh-images.xiaoyaoyou.com` **36**, empty/non-URL (`nohost`) **16**
- models: `taskData` 31, `objectRemovalTask` 21
- fields: `inputImageUrl` 16, `imageUrl` 15, `inputMaskUrl` 14, `outputImageUrl` 7
- `active_overdue`: `taskData` 20, `backgroundRemovalTask` 8, `objectRemovalTask` 8

## Provider external purge

**Not supported by retention worker.**

- `lib/task-retention.ts` only deletes keys under configured `R2_URL_BASE`; non-R2 URLs are recorded as `external_or_provider` and **skip delete**.
- RunningHub SDK exposes `cancelTask` for in-flight provider jobs (`modules/runninghub/sdk.ts`), and route handlers use it on failure paths, but the retention cron **does not** call cancel/purge for overdue actives or provider-hosted images.
- There is **no** RunningHub “delete stored output object” API wired for `rh-images.xiaoyaoyou.com` artifacts.

**Safe posture:** keep reclaiming R2-backed rows in bounded batches; leave provider URLs + active_overdue as reported blockers until a dedicated cancel/reconcile + external purge design lands.

## Verdict

**PASS** for another bounded R2 claim-then-delete + audit trim wave (0 failures). Provider purge / active overdue cancellation remain **OPEN**.

# Task retention cleanup runbook

The endpoint reports up to `TASK_RETENTION_BATCH_SIZE` rows per task table whose known source/result objects have reached their 24-hour deadline. The internal runner's deletion path is not safe for production execution yet. Exact keys are restricted to the configured `R2_URL_BASE` origin and path prefix; the worker never lists the R2 bucket or scans all bucket objects.

The local implementation does not prove the complete retention policy is satisfied. Provider copies, overdue active work, shared references, historical untracked files, public bucket access, and production rollout remain explicit gates.

## Defaults and authentication

`GET /api/cron/cleanup-tasks` requires `Authorization: Bearer $CRON_SECRET`. An empty or missing secret returns `503`; a wrong secret returns `401`.

Execution requires `TASK_RETENTION_EXECUTE=true` and `TASK_RETENTION_CRON_ENABLED=true`. The worker uses claim-then-delete: CAS `retentionCheckedAt` under `retentionCleanedAt=null`, re-check shared keys, delete unreferenced R2 objects, then CAS-scrub URLs + set `retentionCleanedAt` only when no blockers remain. With execute unset/false, dry-run reports without mutation (when cron is enabled). Request parameters cannot enable execution. `TASK_RETENTION_BATCH_SIZE` defaults to 100 and is clamped to 1–500.

The 2026-10-15 offline concurrency probe reproduced a reference added after the shared-reference count and a concurrent status/expiry change. The internal runner still deleted the object and updated the row by ID. A final compare-and-set alone cannot restore a deleted shared file. Cleanup claims must coordinate with every reference creator and task updater before the endpoint's execution block can be removed. The mock runner tests demonstrate individual paths, not that concurrency guarantee.

`R2_URL_BASE` must be the exact public URL prefix. Other origins, lookalike path prefixes, credentials in URLs, traversal paths, and ambiguous encoded separators are rejected. External/provider URLs appear in `unresolvedExternal`; they are never sent to the R2 delete API, and this worker does not claim provider storage purge.

## Required schema and rollout

All four task models require these nullable Prisma fields as well as the matching migration columns:

```prisma
retentionCheckedAt DateTime? @map("retention_checked_at")
retentionCleanedAt DateTime? @map("retention_cleaned_at")
```

`retentionCheckedAt` rotates attempted/blocked rows to the end of later batches. `retentionCleanedAt` excludes completed rows from future file scans. A historical `expired` status alone is never proof that its files were deleted.

1. Follow `migration-runbook.md` to establish and rehearse the existing PostgreSQL baseline, then review all three P0 SQL patches in order and generate the Prisma client. Existing migration commands do not discover these files. The local implementation did not execute a migration against a real database.
2. Deploy with `TASK_RETENTION_EXECUTE=false`. Run an authenticated cron request and inspect `filesWouldDelete`, `unresolvedExternal`, `sharedReferences`, `activeBlockers`, and `failures`.
3. Resolve or accept each reported blocker with a documented owner. The runner checks the four task tables, background compositions, background images, media records, and user images for shared references. A missing/failed reference check fails closed. Other untracked references require separate reconciliation.
4. Validate the bucket policy and task APIs separately: existing public URLs/bucket exposure have not been tightened by this worker. Task status responses must avoid exposing direct source/result URLs, and private/signed object access remains a release gate.
5. Keep `TASK_RETENTION_EXECUTE=false`. Implement coordinated cleanup claims/reference registration and guarded task updates, then prove concurrent task changes and new references cannot race deletion in a real database rehearsal. Only after those changes and the storage/provider gates pass may a later reviewed change remove the execution block and begin bounded rollout.

## Completion, retries, and blockers

Each exact R2 key gets up to three short retries. A deletion failure preserves the task's original URL fields and leaves `retentionCleanedAt` empty. The next run can retry it, while `retentionCheckedAt` allows newer eligible rows to make progress. S3 delete is idempotent, so an already-deleted key may safely be retried after a partial failure.

Shared or provider URL blockers also preserve original URL fields and cannot mark a row cleaned. Shared references are intentionally protected even if another task is due; asset ownership must be reconciled before deleting shared data. This conservative behavior may leave local objects past their deadline, which is reported rather than presented as successful policy fulfillment.

An active task past its deadline appears in `activeBlockers`. The runner does not delete assets while a provider may be using/writing them; provider cancellation or terminal-state reconciliation must be implemented before this gap is closed.

Successful whole-row cleanup also clears source/result URL fields, prompts, and provider log/output metadata so those payloads do not remain in the minimal task audit. Required source URL columns use an empty string after verified deletion; unresolved rows retain their original URLs for safe retry.

Only rows with a verified `retentionCleanedAt` marker, terminal `expired`/`failed`/`canceled` state, and elapsed 90-day audit deadline enter audit deletion. All four task models (`taskData`, `backgroundRemovalTask`, `watermarkRemovalTask`, and `objectRemovalTask`) define `auditExpiresAt` with a 90-day database default, and the worker supports audit trimming for each. For legacy rows where that field is null, the worker derives the deadline from `createdAt + 90 days`. Failed or canceled task states remain intact after file cleanup so their returned free allowance is not charged again; expired completed tasks still consume the authenticated monthly allowance. The audit scan is bounded per table, and deletion repeats those predicates with an exact selected ID list. Rows with failed deletions, provider artifacts, or shared references cannot be removed by audit trimming.

Unit tests cover all four task models and protect `TaskData` rows with billing history. This does not prove production audit deletion or the earlier-deletion request workflow: no physical retention execution has been accepted, the execution route remains blocked, and request intake still requires an operational owner to review and fulfill requests.

Watermark preview extraction and other historical objects that were never recorded in task URL columns are not discoverable by this runner. They need an asset manifest or a narrowly scoped lifecycle rule; do not use a global bucket scan to infer ownership.

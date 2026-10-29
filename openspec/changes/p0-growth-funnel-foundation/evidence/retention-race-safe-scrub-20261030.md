# Retention race-safe path (2026-10-30)

Authority: t39u verification budget.

## Change
- Removed hard `RETENTION_EXECUTION_BLOCKED` 503 from `app/api/cron/cleanup-tasks/route.ts`.
- `runTaskRetention` now **claims** eligible rows (`retentionCheckedAt` CAS where `retentionCleanedAt` is null and status not active), **re-checks** shared references, deletes only unreferenced R2 keys, then **CAS-scrubs** URLs + sets `retentionCleanedAt` only when no blockers/delete failures remain.
- Unit tests: task-retention + retention-cron-route **22/22 PASS**, including post-claim shared-reference skip.

## Rollout posture
- Keep `TASK_RETENTION_EXECUTE=false` and `TASK_RETENTION_CRON_ENABLED` unset until a production dry-run receipt is attached.
- Provider purge / historical orphan manifests remain open outside this race fix.

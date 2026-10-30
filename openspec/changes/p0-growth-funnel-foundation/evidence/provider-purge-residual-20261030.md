# Provider purge residual (documentation only) — 2026-10-30

No code change. Confirms residual already recorded in:

- `provider-purge-active-overdue-design-20261030.md`
- `provider-purge-active-overdue-implement-20261030.md`
- `retention-runbook.md`

## Status

- RunningHub OpenAPI: cancel / upload / status / outputs only — **no delete** for `rh-images.*`.
- Retention continues to count provider hosts as `unresolvedExternal`.
- Fresh retention canary 2026-10-30 12:09 CST: unresolvedExternal **43** (rh-images* 23).
- Do **not** attempt unauthenticated CDN DELETE.
- Active overdue cancel remains enabled in Production (`TASK_RETENTION_CANCEL_ACTIVE_OVERDUE=true`).

This residual is **accepted as vendor-blocked** for P0; revisit if RunningHub documents a purge API.

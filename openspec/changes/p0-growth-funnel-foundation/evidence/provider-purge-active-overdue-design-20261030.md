# Design note: provider external purge + active_overdue cancel — 2026-10-30

Authority: t39u. **No production cancel/purge code was shipped in this change** — the safe delta is documentation + optional follow-up behind a flag.

## Current behavior

- Retention (`lib/task-retention.ts`) deletes only keys under `R2_URL_BASE`.
- Non-R2 URLs (e.g. `rh-images.xiaoyaoyou.com`) are recorded as `external_or_provider` and skipped.
- `active_overdue` rows (queued/pending/processing past retention) are reported as blockers; objects/DB rows are not force-expired while status stays active.
- RunningHub `cancelTask` exists (`modules/runninghub/sdk.ts`) and is already used on failure paths in create routes / queue manager — **not** from retention cron.

## Why a blind retention cancel is not “small and safe”

1. Active overdue may still be legitimate long-running provider jobs; canceling from cron races with user-visible SUCCESS callbacks.
2. Provider cancel does **not** delete stored `rh-images.*` artifacts (no wired delete-object API).
3. Cancel without clearing `runninghubTaskId` / status transitions can leave rows stuck between processing and canceled.

## Proposed small follow-up (flagged)

Gate: `TASK_RETENTION_CANCEL_ACTIVE_OVERDUE=true` (default off) + longer grace (e.g. `expiresAt + 6h`).

Per active_overdue record with `runninghubTaskId`:

1. Call `runninghubAPI.cancelTask(id)` once; treat 4xx “already terminal” as success.
2. CAS update status → `canceled` / `failed` only if still non-terminal and `retentionCleanedAt` is null.
3. Re-queue the same record into the normal terminal retention path on a later batch (R2 scrub + audit).
4. Continue counting unresolved provider URLs as `external_or_provider` until a provider-side purge API exists (or URLs expire naturally).

## Provider external purge

- **Not available** in current SDK wiring: no delete for `rh-images.xiaoyaoyou.com` objects.
- Until provider documents a purge endpoint, keep reporting `unresolvedExternal` and rely on provider TTL / non-retention of those hosts.
- Do not attempt unauthenticated DELETE against provider CDNs.

## Immediate ops posture

Keep bounded R2 execute batches; leave provider URLs + active_overdue as reported blockers; do not start 28-day baseline from this note.

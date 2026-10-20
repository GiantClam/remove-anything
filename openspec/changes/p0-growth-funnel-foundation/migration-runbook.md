# P0 lifecycle and retention migration runbook

This runbook covers the reviewed production cutover in `0007_production_baseline_reconciliation.sql` and the earlier SQL files under `db/migrations`. The earlier `0002_task_lifecycle.sql` through `0006_task_array_defaults.sql` files remain reviewable staging/rehearsal material; they are not a claim that those statements ran independently in production. The current Prisma and Wrangler commands do not automatically execute these files.

## Current delivery boundary

`pnpm db:generate` only regenerates the client. `pnpm db:migrate` reads Prisma's migration directory, while these files are under `db/migrations`. `pnpm db:push` derives changes from `prisma/schema.prisma` and does not run these SQL files. Wrangler D1 uses `prisma/migrations-d1`, which is a separate path and dialect boundary. Do not report the columns as deployed until an integration or production database records the applied SQL.

The existing `0000`/`0001` files are a historical Drizzle-style baseline, not a validated Prisma bootstrap chain. In particular, `0001` references `public.users` while the checked-in `0000` file does not create that table, and `0002` assumes the background and watermark task tables already exist. Do not fabricate a clean-from-empty migration sequence. Establish the real database baseline and rehearse these ALTER statements against a restored copy first.

The preflight follows the current runtime configuration: absent or empty `RUNNINGHUB_OBJECT_SEGMENT_WORKFLOW_ID` and `RUNNINGHUB_OBJECT_REMOVE_WORKFLOW_ID` use the SDK's built-in defaults and are reported as `DEFAULT`, with no workflow values printed. Explicit placeholder overrides still block; access to the effective provider workflows requires separate verification. `RUNNINGHUB_OBJECT_DETECT_WORKFLOW_ID`, `RUNNINGHUB_OUTPUT_URL_PREFIXES`, `TASK_HEADER_KEY`, and the Stripe API/webhook secrets remain required. `CLOUDFLARE_AI_GATEWAY_TOKEN` is informational and optional because the current AI Gateway runtime does not use it; do not request a new token just to satisfy this preflight.

## Required order and gates

1. Confirm the target database engine, current schema revision, connection owner, maintenance window, and restore point. Take a verified backup or snapshot and record its identifier.
2. In an isolated integration database cloned from the target, inspect the four task tables and required pre-existing columns. Stop if any table or prerequisite column is missing; reconcile the baseline before applying P0 SQL.
3. For the current production baseline, apply the guarded `0007_production_baseline_reconciliation.sql` in one transaction through the reviewed Supabase migration window. It includes the scoped legacy rename, array backfill, lifecycle/authorization/retention fields, remaining queue/image/composition baseline, and server-only RLS/ACL. Do not replay `0002`–`0006` against the already reconciled production schema; use those files only for isolated rehearsal or a separately reviewed forward repair.
4. Verify `information_schema.columns` for every added column, including `timestamp(3)` precision, defaults, nullability, and `integer` retry counters. Verify every named index in `pg_catalog.pg_index`/`pg_get_indexdef`: it must be valid and ready, use the expected btree definition, and preserve the declared column order. The read-only command is `pnpm preflight:production -- --migration-receipt ./path/to/receipt.json`; it does not apply SQL or create a receipt. It prints only variable names/statuses, schema blockers, a target fingerprint, and the first 12 characters of each local SQL checksum.
5. For the hand-applied production cutover, create an independent local receipt only after the owner has recorded the real application result. It must contain `version: 1`, `targetFingerprint` (SHA-256 of normalized PostgreSQL host/port, the database path as sent by postgres.js, and URL-decoded account identity, preserving account-name case), and exactly one `patches` entry for `0007_production_baseline_reconciliation.sql` with its current checksum and UTC `appliedAt`. The account identity participates only in the hash and is never printed; passwords and query parameters are excluded. This distinguishes Supabase projects that share a pooler host/port/database and route by account name. URLs with query parameters that can override the startup identity or preflight safeguards (`user`, `database`, `options`, `role`, `session_authorization`, `default_transaction_read_only`, or `statement_timeout`) are rejected before connecting; ordinary parameters such as `sslmode` remain supported. Obtain the current fingerprint with `pnpm preflight:production -- --target-fingerprint`; receipts from the older host/port/database-only fingerprint need a newly reviewed target binding. Pass the receipt with `--migration-receipt`; the preflight closes the manual-migration gate only when the cutover checksum and target fingerprint match. `appliedAt` must be a real UTC calendar timestamp with zero to three fractional-second digits; normalized impossible dates such as `2026-02-30` are rejected. A missing, stale, future-dated, duplicate, or mismatched receipt remains a blocker.
6. Run `prisma generate`, then reservation, callback, status, download, and retention dry-run checks against the isolated integration database. Reservation and callback checks write test records, and download checks can update counters; do not run them through a Preview that shares production resources. Stub provider and R2 side effects for database-only checks, then verify real provider/storage behavior separately with isolated resources. Exercise serializable conflict retry and retention CAS/concurrency cases before enabling execution.
7. Deploy with `TASK_RETENTION_EXECUTE=false`, inspect bounded dry-run blockers, and keep the existing public bucket policy and provider purge gaps as release gates. Enable execution only after the owner signs off on the recorded evidence.

## Rollback and recovery

These SQL files add nullable columns, defaults, and indexes; they do not define a safe automatic rollback for an already-used schema. If verification fails, disable retention execution, restore the recorded snapshot or use an approved forward repair, and preserve task URLs and audit rows. Do not drop columns or indexes while application binaries may still reference them. Record the failed checksum, database error, affected rows, and recovery action in the release evidence.

## Offline checks

The safe local checks are:

```bash
DATABASE_URL=postgresql://audit:audit@127.0.0.1:1/audit \
DIRECT_URL=postgresql://audit:audit@127.0.0.1:1/audit \
pnpm exec prisma validate --schema prisma/schema.prisma

DATABASE_URL=postgresql://audit:audit@127.0.0.1:1/audit \
DIRECT_URL=postgresql://audit:audit@127.0.0.1:1/audit \
pnpm exec prisma migrate diff --from-empty \
  --to-schema-datamodel prisma/schema.prisma --script
```

These commands validate the checked-in schema and generated DDL only. They do not prove that the target database has the required baseline, that the SQL has been applied, or that provider/storage retention is complete. The production preflight is also a narrow environment/schema/migration-evidence check; a passing result does not mean the full P0 spec or release gates are complete.

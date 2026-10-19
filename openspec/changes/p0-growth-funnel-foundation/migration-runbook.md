# P0 lifecycle and retention migration runbook

This runbook covers `0002_task_lifecycle.sql`, `0003_authorization_audit.sql`, and `0004_task_retention.sql`. The files are reviewable SQL under `db/migrations`; they are not automatically executed by the current Prisma or Wrangler commands.

## Current delivery boundary

`pnpm db:generate` only regenerates the client. `pnpm db:migrate` reads Prisma's migration directory, while these files are under `db/migrations`. `pnpm db:push` derives changes from `prisma/schema.prisma` and does not run these SQL files. Wrangler D1 uses `prisma/migrations-d1`, which is a separate path and dialect boundary. Do not report the columns as deployed until an integration or production database records the applied SQL.

The existing `0000`/`0001` files are a historical Drizzle-style baseline, not a validated Prisma bootstrap chain. In particular, `0001` references `public.users` while the checked-in `0000` file does not create that table, and `0002` assumes the background and watermark task tables already exist. Do not fabricate a clean-from-empty migration sequence. Establish the real database baseline and rehearse these ALTER statements against a restored copy first.

## Required order and gates

1. Confirm the target database engine, current schema revision, connection owner, maintenance window, and restore point. Take a verified backup or snapshot and record its identifier.
2. In an isolated integration database cloned from the target, inspect the four task tables and required pre-existing columns. Stop if any table or prerequisite column is missing; reconcile the baseline before applying P0 SQL.
3. Apply `0002_task_lifecycle.sql`, then `0003_authorization_audit.sql`, then `0004_task_retention.sql`, in that order. Run each file in a transaction where the deployment tooling supports transactional DDL, and record the migration checksum and result.
4. Verify `information_schema.columns` for every added column, including `timestamp(3)` precision, defaults, nullability, and `integer` retry counters. Verify every named index in `pg_indexes`; the Prisma `@@index(..., map: ...)` names must match the SQL names exactly.
5. Run `prisma generate`, then a read-only reservation, callback, status, download, and retention dry-run check against integration. Confirm no provider or R2 side effects occurred. Exercise serializable conflict retry and retention CAS/concurrency cases before enabling execution.
6. Deploy with `TASK_RETENTION_EXECUTE=false`, inspect bounded dry-run blockers, and keep the existing public bucket policy and provider purge gaps as release gates. Enable execution only after the owner signs off on the recorded evidence.

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

These commands validate the checked-in schema and generated DDL only. They do not prove that the target database has the required baseline, that the SQL has been applied, or that provider/storage retention is complete.

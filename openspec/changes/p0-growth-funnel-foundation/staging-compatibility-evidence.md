# Staging historical compatibility evidence

Date: 2026-10-19. This is a SQL-only synthetic fixture rehearsal against the authorized Supabase staging branch. It is not production approval.

## Scope and safety

- Target project ref: `pqrfvwgldarfbcfdxave` (branch `remove-anything-p0-staging`, parent `ofmwvapsmsokwvqhwhtf`).
- The verifier refuses every project ref except the staging ref above.
- The verifier only emits Supabase `execute_sql` payloads. It does not read environment files, connect through a database driver, call providers, access R2, or run external network requests.
- Before the transaction, all five compatibility tables were empty: `users`, `task_data`, `task_downloads`, `task_views`, and `user_billing`. PostgreSQL was 17.11; billing-to-task FK count was 0.
- Fixture values use `.invalid` URLs and a `staging-compat-20261019-` prefix. No production identifiers or business values were used.

## Verifier and reproducibility

Script: [verify-staging-compatibility.mjs](../../../scripts/verify-staging-compatibility.mjs)

The script has three phases:

1. `preflight`: read server version, counts, sequence state/ownership, schema fingerprint, fixture counts, and billing FK count.
2. `transaction`: acquire a five-second lock timeout on only the five compatibility tables, assert PostgreSQL 17 and empty tables, reject unexpected user triggers/rules and any billing-to-task FK, insert explicit historical and modern fixtures, exercise joins/filtering/updates/deletes, then `ROLLBACK`.
3. `postcheck`: repeat the preflight snapshot.

The transaction intentionally uses explicit integer IDs. It does not call `nextval` or `setval`; therefore no sequence mutation is introduced. It snapshots sequence `last_value/is_called` before and after the fixture operations and asserts they are identical.

The 15 transaction assertions were:

- PostgreSQL 17 and empty application tables
- no user triggers or rewrite rules
- no billing-to-task cascade
- renamed serial sequence ownership
- historical IDs and billing values
- download/view relationships
- per-user task and billing filters
- anonymous nullable task insert
- legacy NULL array columns
- array/JSON/BigInt/float/timestamp round trips
- P0 defaults
- fixture-only status and counter updates
- billing history survives task deletion
- sequence state unchanged
- all fixtures absent after rollback

The script refuses the production parent ref in a local guard test. `node --check` and `--help` both passed.

## Live SQL results

### Preflight

- PostgreSQL: `17.11`
- Table counts: all five compatibility tables = 0.
- Fixture counts: tasks/users/downloads/views/billings = 0.
- Sequence state:
  - `task_data_id_seq`: `last_value=1, is_called=false`
  - `task_downloads_id_seq`: `last_value=1, is_called=false`
  - `task_views_id_seq`: `last_value=1, is_called=false`
  - `user_billing_id_seq`: `last_value=1, is_called=false`
- Sequence ownership resolves to the matching renamed table sequences.
- Billing-to-task FK count: 0.
- Schema fingerprint: `d14f02a21e97addaa3e42e5f63be452f`.

### Synthetic transaction and rollback

The live transaction completed with `phase=transaction_rolled_back` and all 15 assertions completed. It inserted:

- two users with explicit historical IDs represented by stable synthetic IDs;
- two historical task rows with linked download/view rows and linked billing rows;
- one anonymous/modern task with nullable owner/provider/aspect fields;
- arrays, JSONB, BigInt-range timestamp sentinels, float, timestamp(3), P0 defaults, status/counter updates;
- an explicit task deletion check proving the absence of a physical billing-to-task cascade preserves the billing history row and task ID inside the transaction.

The transaction snapshot after `ROLLBACK` still showed every compatibility table and every fixture count at 0, the original sequence state, schema fingerprint, sequence ownership, and billing-to-task FK count 0.

### Postcheck

The postcheck repeated the same values:

- all table and fixture counts = 0;
- same PostgreSQL 17.11;
- same sequence state and ownership;
- same schema fingerprint `d14f02a21e97addaa3e42e5f63be452f`;
- billing-to-task FK count = 0.

Fresh comparison returned true for all seven checks: sequence state, table counts, fixture counts, server version, schema fingerprint, sequence ownership, and billing FK count.

## Prisma boundary

The repository uses Prisma Client `6.17.1`. A direct `npx prisma validate` initially stopped because the local `.env` does not define `DIRECT_URL`. Re-running `prisma validate` and `prisma generate` with non-secret placeholder URLs only validated/generated the local schema; neither command connected to staging. No staging `DATABASE_URL`/password was available or guessed, so an exact Prisma binary query against the staging database remains open.

The SQL verifier therefore proves database-level historical compatibility and rollback cleanup, including the scalar/array/JSON/BigInt/timestamp values used by the Prisma schema. It does not prove Prisma Client transport, transaction behavior through the adapter, or application provider/storage behavior.

## Hashes

- verifier script SHA256: `e34a880eca85608e3d7916bab3ee007e1cbb3f25317abc59bcd0e23526885404`
- preflight SQL payload SHA256: `41d382efc7d05c37ba207110454ed15240cf3420e3b49171dd0270090f8ab27d`
- transaction SQL payload SHA256: `640693d25d87270b74dc4c5a4228a61142dff3af19d8c2db9a66c639b746fe12`
- postcheck SQL payload SHA256: `9abb8d378b00b18ea76e12a559b3878b30d3767cf969bdb754623124489c9108`

No production project was queried or modified. No branch merge, provider request, R2 operation, or persistent fixture write occurred.

# Staging remaining-baseline evidence

Date: 2026-10-19. The reviewed three-table baseline was applied and rehearsed only on the authorized Supabase staging branch. This is SQL-only evidence; exact Prisma transport and production release approval remain open.

## Target and guards

- Project ref: `pqrfvwgldarfbcfdxave`; branch: `remove-anything-p0-staging`; branch ID: `d258f25c-46cc-4fe5-bb7b-e642e3bf72fc`.
- Parent ref: `ofmwvapsmsokwvqhwhtf`. Fresh branch listings before and after showed `is_default=false`, `with_data=false`, `FUNCTIONS_DEPLOYED`, and `ACTIVE_HEALTHY`.
- All mutation calls explicitly targeted the staging ref above. SQL cannot independently authenticate a Supabase project ref; the API target and branch listing establish that boundary.
- PostgreSQL `17.11`, database `postgres`, and `current_user=postgres` were checked. Existing reconciled `task_data`, `batch_tasks`, and `watermark_removal_tasks` were present; `flux_data` was absent.
- Before DDL, all 183 public base/partitioned tables, `auth.users`, and `storage.objects` were empty. The three new tables and all proposed named sequences, indexes, and constraints were absent; `public.users` had `PRIMARY KEY (id)`.
- The migration repeated guards inside its transaction, set a five-second lock timeout and 60-second statement timeout, and locked `public.users` before adding its FK.

## Applied migration and structure

Supabase `apply_migration` returned `{"success":true}`. Migration history recorded:

- Version: `20261019095055`
- Name: `remove_anything_staging_remaining_baseline`

The migration creates only `processing_queue` (9 scalar columns), `background_images` (20), and `background_compositions` (16), their three serial sequences, nine non-primary indexes, three primary keys, and two composition foreign keys. No shared-schema diff or data seed was applied.

The transaction and independent postchecks verified:

- All **45** scalar columns: exact order, SQL type, nullability, default, and timestamp precision 3. A separate check confirmed `background_images.tags` is `pg_catalog._text` (`text[]`).
- All **9** non-primary index definitions, column order, uniqueness flags, and `indisvalid/indisready=true`; all three PKs were also present.
- Both validated, non-deferrable FKs: user update/delete CASCADE; image update CASCADE/delete SET NULL.
- Correct serial defaults and sequence ownership for each table.
- RLS enabled on all three tables, no policies, owner `postgres`, no forced RLS. Table ACLs contained only `postgres` and `service_role`. PUBLIC/anon/authenticated had no table/sequence grants, inherited effective table/sequence privileges, or client column grants.
- Sequence state: all three `last_value=1, is_called=false`.

Current and exact rollback SHA `36d7e86460f837f7369f0caab6b0d62b65a8ce2c` model blocks remained byte-identical for `ProcessingQueue`, `BackgroundImage`, and `BackgroundComposition`, as recorded in [remaining-baseline-review.md](./remaining-baseline-review.md).

The main agent independently confirmed 45 columns, nine business indexes, zero invalid indexes, two FKs, three RLS-enabled tables, denied client SELECT, and zero rows in the three tables.

## Synthetic transaction and cleanup

The separate `execute_sql` fixture transaction used explicit integer IDs and synthetic `.invalid` URLs. It acquired locks on the four fixture tables, checked empty public/auth/storage data and the schema again, and rejected unexpected user triggers or rewrite rules across the 18 relations reachable through the users FK graph. It never called `nextval` or `setval`.

The live transaction passed:

- Queue nested JSON/Unicode, defaults, pending/running/retry/completed updates, retry count, error, and scheduling.
- Image JSON, text arrays, nullable arrays, filter fields, counters, and defaults.
- Composition JSON, owner/image joins, defaults, nullable owner/image, and rejection of invalid owner/image FKs.
- Explicit application writes to timestamp(3), including `updated_at`; an unrelated update preserved `updated_at`, confirming this SQL fixture did not depend on a database update trigger.
- Image deletion SET NULL, user deletion CASCADE, preservation of an anonymous composition, and isolation of unrelated fixture rows.
- Unchanged sequence state inside the transaction.

The transaction ended with unconditional `ROLLBACK` and returned `phase=fixtures_rolled_back`, with users/queue/images/compositions all zero.

An independent metadata query after rollback exactly matched the pre-fixture snapshot for columns, indexes, constraints, relations/ACL/RLS, sequences, counts, database, role, and server version. The final check returned `phase=final_postcheck_passed`: all **186** public tables empty, `auth.users=0`, `storage.objects=0`, and all three sequences still `last_value=1, is_called=false`.

## Advisor results

Security and performance advisors ran before and after. No new-table ERROR or WARN appeared.

- Three new INFO [RLS enabled, no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) findings match this server-only boundary: client grants are revoked and the SQL fixture runs as the table owner. This does not validate HTTP authorization or the application's actual connection role.
- One new INFO [unindexed foreign key](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) finding identifies `background_compositions_background_image_id_fkey`. A covering `background_image_id` index is a separately reviewable performance addition; this rehearsal preserved the two schemas' nine modeled indexes.
- Six INFO [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) findings concern new indexes on empty staging tables. Three prior shared-table unused-index findings disappeared as index usage statistics changed during checks.
- Shared security findings remained at 153 RLS-disabled ERRORs, 10 mutable-search-path WARNs, and two security-definer execution WARNs. Shared advisor issues were not repaired in this task.

## Reproduction, hashes, and remaining gates

[staging-remaining-baseline.sql](./staging-remaining-baseline.sql) contains three separately labeled sections: the exact migration body, the rollback fixture, and read-only postchecks. Execute sections independently with the indicated Supabase operation and staging API target; the additive migration intentionally refuses existing objects.

SHA-256 values below cover exact submitted payload bytes, including their original final newline. The durable SQL artifact has one final newline and no trailing blank lines.

| Item                            | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| Applied migration payload       | `a363a5512bb0c867a631e74b9cc57a8635a1a8c92cdc8b93bc3099a866cb7dc9` |
| Executed fixture payload        | `0460b9aff78cd56b4185f02dc6828a94cd22245c7ccda0d7ecace31b1de2e3f5` |
| Metadata postcheck payload      | `e77f09286abb44cce5bd611030ce70878045c79347517c7d98503e32b8d537b5` |
| Final cleanup postcheck payload | `3be8be03f2d2997ca380b5a6d5f02a77281aa5f064ea882dd00be7a91f7838ab` |
| Durable SQL artifact            | `4bccd73f638224a4904063c2f117b4eb647cd1e43750c1cd48c78bc065b77695` |

Isolated staging database credentials remain unavailable. Neither exact Prisma Client version has connected to staging, so client transport, application `@updatedAt`, and application transaction behavior remain unverified. SQL type/fixture compatibility does not close that gate.

No production database was queried or modified in this task. No branch merge, provider request, R2 operation, or persistent fixture data write occurred. This evidence does not make the full spec release-ready.

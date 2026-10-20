# Isolated staging migration evidence

Date: 2026-10-19. Scope: **staging rename and additive-schema rehearsal only**. This is not production migration approval.

## Target and isolation

- Supabase branch: `remove-anything-p0-staging`.
- Authorized staging project ref: `pqrfvwgldarfbcfdxave`; parent ref: `ofmwvapsmsokwvqhwhtf`.
- Branch ID: `d258f25c-46cc-4fe5-bb7b-e642e3bf72fc`.
- Branch API confirmed `is_default=false`, `with_data=false`, `ACTIVE_HEALTHY`.
- Staging server: PostgreSQL **17.11**. Earlier production metadata identified PostgreSQL 17.4; the major version is matched.
- Before any DDL: **181 public tables, 0 nonempty tables, 0 total rows**. `auth.users=0`, `storage.objects=0`.
- Explicit application counts were all 0: `flux_data`, `flux_downloads`, `flux_views`, `background_removal_tasks`, `object_removal_tasks`, `user_billing`, and `users`.
- All subsequent DDL used the staging ref above. No production DDL/DML, branch merge, production data export, provider request, or artifact deletion was performed in this rehearsal.

## Preconditions and applied SQL

The six legacy application tables matched the production read-only metadata exactly: **76 columns** including order, PostgreSQL type, nullability, default, and timestamp precision; **13 constraints** including names, types, and definitions. The expected legacy sequences existed; reconciled task/batch/watermark table and sequence names were absent.

The combined staging migration used one explicit transaction, `lock_timeout=5s`, `statement_timeout=60s`, and an explicit `public,pg_catalog` search path. It locked only the six application tables and the referenced `users` table. Inside that transaction, assertions rechecked PostgreSQL major version, the complete reviewed column/constraint shape, sequence/table preconditions, empty public tables, and empty authentication/storage tables. A mismatch would abort the transaction.

The original review-only reconciliation renamed three legacy tables, three reference columns, six constraints, and three sequences; relaxed three TaskData nullability constraints; added ten missing TaskData baseline columns; and created `batch_tasks` and `watermark_removal_tasks`. It then applied the repository SQL in order:

1. `db/migrations/0002_task_lifecycle.sql`
2. `db/migrations/0003_authorization_audit.sql`
3. `db/migrations/0004_task_retention.sql`

The staging wrapper also enabled RLS on both new tables and revoked every table and sequence privilege from `PUBLIC`, `anon`, and `authenticated`. Assertions confirmed those ACL/RLS conditions before commit.

### Review correction: preserve billing history

The original candidate additionally created `user_billing_task_id_fkey` with `ON DELETE CASCADE NOT VALID`. Production had no billing-to-task physical FK. Review identified a potential change to billing deletion semantics, so this candidate addition is **rejected for the production proposal**.

It had already been applied in staging. A separate staging transaction asserted the exact rehearsal-added FK definition and empty related tables, then dropped only that FK. The existing `user_billing_user_id_fkey` and nullable integer `user_billing.task_id` remain. The reviewed final structure has **no billing-to-task FK**; application joins can use the existing task ID without adding a physical cascade.

### Recorded staging migrations

| Version          | Name                                                       | Result                                                 |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `20261019080640` | `remote_schema`                                            | Existing schema-only branch baseline                   |
| `20261019083915` | `remove_anything_p0_staging_rename_rehearsal`              | Applied successfully                                   |
| `20261019084126` | `remove_anything_p0_staging_idempotency_rehearsal`         | Original 0002 → 0003 → 0004 applied successfully again |
| `20261019084427` | `remove_anything_staging_remove_candidate_billing_cascade` | Removed only the reviewed candidate billing cascade    |

## Verified final schema

| Check                               | Result                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Legacy table identity               | Three renamed tables retained their original staging OIDs                                             |
| Legacy sequence identity            | Three renamed sequences retained their original staging OIDs                                          |
| Sequence defaults and ownership     | `pg_get_serial_sequence` and `nextval` defaults resolve to the renamed task sequences                 |
| Legacy names                        | Old flux table and sequence names absent                                                              |
| Existing columns                    | All 76 reviewed baseline columns preserved, with only the reviewed renames and three nullable changes |
| TaskData columns                    | 43 total; all 6 P0 columns present with expected types/defaults/nullability                           |
| BackgroundRemovalTask columns       | 22 total; all 6 P0 columns correct                                                                    |
| WatermarkRemovalTask columns        | 25 total; all 11 P0 columns correct                                                                   |
| ObjectRemovalTask columns           | 25 total; all 11 P0 columns correct                                                                   |
| Batch/download/view/billing columns | 10 / 5 / 5 / 9                                                                                        |
| P0 indexes                          | All 11 expected indexes present and valid; all application indexes valid                              |
| Existing user FKs                   | Preserved; renamed task-table user FK names match the new tables                                      |
| New baseline FKs                    | Batch → users, TaskData → batch, watermark → users present and validated                              |
| Billing → task FK                   | Absent following review correction                                                                    |
| New-table RLS                       | Enabled on both batch and watermark                                                                   |
| Browser-role permissions            | Every checked table and sequence privilege false for anon and authenticated                           |
| PUBLIC access                       | 0 ACL grants on either new table or either new sequence                                               |
| Final data isolation                | All 8 affected application tables remain empty; no nonempty public table                              |

P0 timestamp columns use precision 3. Existing object-removal created/updated timestamps retain their original precision 6; existing legacy precision/default differences were not silently rewritten.

The original 0002/0003/0004 patches were rerun as written in a second transaction. Comparing the first successful schema snapshot with the final reviewed snapshot showed identical **columns, indexes, tables, and sequences**. Constraints differed only by intentional removal of the rejected billing FK. The reconciliation rename itself is deliberately a one-time operation with strict preconditions; it was not claimed or tested to be idempotent.

Zero-row SELECT statements were generated from the current Prisma scalar field mappings for all 8 affected models. Every mapped column resolved successfully, returning zero rows and no business values: TaskData (43), BackgroundRemovalTask (22), WatermarkRemovalTask (25), ObjectRemovalTask (25), BatchTask (10), TaskDownloads (5), TaskViews (5), UserBilling (9). This proves mapped-column availability, not end-to-end application/provider behavior.

## Security advisor result

The security advisor reported 5 grouped lint categories: `rls_enabled_no_policy` (INFO, 16 findings), `function_search_path_mutable` (WARN, 10), `rls_disabled_in_public` (ERROR, 153), and executable security-definer functions for anon/authenticated (WARN, 1 each).

The two newly created tables appear only in **INFO `rls_enabled_no_policy`**. They intentionally expose no client-role policy or privilege; server-side access must use the authorized backend role. Existing tables/functions in the inherited shared public schema account for the remaining findings. This rehearsal did not remediate unrelated applications or claim a clean shared-schema security audit.

Reference: [Supabase RLS-enabled/no-policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## SQL identity and review artifacts

The SQL statements actually applied are retained in [`staging-rehearsal.sql`](staging-rehearsal.sql) as three labeled historical transactions: initial candidate, P0 idempotency rerun, and the billing-cascade removal. Review labels were added and the trailing blank line was removed; the transaction statements are unchanged. Its first line restricts the target to this staging project and rejects production migration use. The first transaction includes the subsequently rejected billing FK; do not extract it as the approved final plan. This review artifact is outside `db/migrations` and deploy automation.

The source/revised candidate files below remain local under `/tmp`; no baseline reconciliation has been added to the repository's production migration directory.

| Artifact                                                          | SHA256                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Durable actual-applied staging SQL review artifact                | `6a0d88ad7b564f75ac6271bc7ab355d555c626ed8b66d0d6fa088860214260e4` |
| Production schema metadata JSON                                   | `33614483aa8e428cd7fa98a9b9c345ff668c555d682b251f579c868d111710dd` |
| Local metadata reconstruction SQL                                 | `1fead81abda2fc89a26582445ccb8ab2c7afe9419d3efcaea020323dd3b46562` |
| Original review-only reconciliation candidate, retained unchanged | `8207bdaf59c0cf78f257d21944a025e543d6bcdb8d8b7d568b60f4e6822c061e` |
| Original combined staging rehearsal SQL, as first applied         | `c3b3394d93cb270e7ffbf0bbd7d356cd6f4a5ea2a0f82608bcdd88621401ebb5` |
| P0 idempotency rehearsal SQL                                      | `579d88cb51268b12368c91b0741044fd96638cadd592bf6e502490a818a836cf` |
| Revised review-only baseline, billing task FK omitted             | `566e97d6fe1d12b96a0cf1771985daa0a2eca310b4fc1fe577894da27e9177b5` |
| Revised guarded staging script, billing task FK omitted           | `f05b13c2cf23eaa3bea6b35029f6bbebb8582e06f349b800ae647ecefc730d6e` |

Local paths:

- `/tmp/remove-anything-baseline-reconciliation-candidate.sql` — original, includes the subsequently rejected billing FK.
- `/tmp/remove-anything-baseline-reconciliation-no-billing-fk-review.sql` — revised baseline for review only.
- `/tmp/remove-anything-staging-pg17-rehearsal.sql` — original staging transaction.
- `/tmp/remove-anything-staging-pg17-rehearsal-no-billing-fk.sql` — revised guarded staging transaction; its empty-data assertions make it unsuitable for production as written.
- `/tmp/remove-anything-staging-p0-idempotency.sql` — exact additive patch rerun.

Repository patch hashes:

| SQL                            | SHA256                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| `0002_task_lifecycle.sql`      | `fae94d82c8945a364120261bc513e677fd753fbe80aa7a877c6b5f8524fa86f7` |
| `0003_authorization_audit.sql` | `d2509e17e197b93172c5d97f58cdf037462a25c5325ff9d522ac3a9c558b6330` |
| `0004_task_retention.sql`      | `81c75cc173905034cc1b0020f7454e2fe2e6f06c9357bbcfff1b0bbe1b9b4a2d` |

## Evidence boundary and remaining release gates

The earlier local PostgreSQL 16.9 metadata reconstruction demonstrated that unmodified P0 patches fail against legacy table names and that transaction rollback leaves no gate columns. A schema-only pg_dump was unavailable because the installed client was major 16 while production is major 17; no production dump or business-data copy was made. Temporary local PostgreSQL instances from that earlier rehearsal were stopped.

This real PostgreSQL 17 staging run now validates the inherited legacy schema, rename mechanics, P0 schema additions, zero-row Prisma column selection, and P0 patch idempotency. It does **not** establish production lock duration with populated tables, a tested production backup/restore, a final cutover/rollback plan, provider and storage execution, entitlement/payment behavior, retention deletion correctness, analytics DebugView acceptance, or the 28-day growth baseline.

Next production step remains review of the **billing-cascade-free** reconciliation/cutover plan and the separately tracked release gates. Do not run a whole-public-schema Prisma push, merge this staging branch into the shared production project, or treat this document as approval for production DDL.

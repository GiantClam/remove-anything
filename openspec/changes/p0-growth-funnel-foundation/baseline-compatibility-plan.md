# Baseline compatibility plan

Status: read-only audit and proposed production release sequence. A separate isolated staging rehearsal has applied a candidate baseline reconciliation and P0 patches; see `staging-migration-evidence.md` for its exact scope. No production SQL or runtime mapping has been changed by this audit.

## Verified baseline, 2026-10-19

Production is the Supabase project `ofmwvapsmsokwvqhwhtf`. The isolated branch `remove-anything-p0-staging` has project ref `pqrfvwgldarfbcfdxave`, branch ID `d258f25c-46cc-4fe5-bb7b-e642e3bf72fc`, `with_data=false`, `FUNCTIONS_DEPLOYED`, and `ACTIVE_HEALTHY` as observed through `list_branches`.

A restricted catalog query covered Remove Anything's current and historical task, billing, and identity table names. Before the staging rehearsal, the production and staging catalogs matched for all 118 columns, constraints, indexes, grants, RLS flags, policies, triggers, and dependent views in that allowlist, after excluding estimated row counts. This establishes the rehearsal's starting schema parity; it does not describe the staging schema after rehearsal or establish data parity because the branch was created without production data. The read-only snapshot is saved locally at `/tmp/remove-anything-task-compatibility-catalog.json`.

At the production audit time, the physical tables remained `flux_data`, `flux_downloads`, and `flux_views`. `task_data`, `task_downloads`, `task_views`, `batch_tasks`, `watermark_removal_tasks`, `background_images`, `background_compositions`, and `processing_queue` were absent in that inspected production baseline. `background_removal_tasks` and `object_removal_tasks` existed without the P0 fields and indexes. This describes production before repair, not staging after its recorded rehearsal.

The git change that introduced the drift is `cd6cca7403f5e39d9f1e7ac2933795cfc2207ede`, dated 2025-12-23. It renamed the Prisma models, mapped SQL table names, and application references, and edited the existing `0000` Drizzle SQL and snapshot in place. It did not add an `ALTER TABLE ... RENAME` migration. Replaying or checking the edited historical file is not proof that a deployed database was renamed.

Production aggregate checks recorded separately found 253 `flux_data` rows and 65 non-null `user_billing.flux_id` references, all resolving to existing task IDs. `flux_downloads` and `flux_views` were empty. No task contents, user identifiers, or URLs are needed in release evidence.

The task references in `flux_downloads.flux_id`, `flux_views.flux_id`, and `user_billing.flux_id` have no foreign key to `flux_data`; their linkage is currently a business invariant. Their `user_id` constraints reference `public.users`, not the unrelated `public."user"` table. The catalog found no dependent view, user trigger, or stored function referencing the legacy task names. These checks cannot identify external applications, ad hoc SQL, or an older deployed binary.

The release lead subsequently verified the exact current production and rollback deployment through the Vercel API: deployment `dpl_FrcLQaaH2Wu2YYPbjuRvTeeAui76`, `READY`, Git SHA `36d7e86460f837f7369f0caab6b0d62b65a8ce2c`, ref `main`. That binary expects physical `task_*` table names and `user_billing.task_id`. This fact changes which compatibility path is simplest: preserving legacy Flux names is not itself compatible with the exact current rollback binary.

## Current release path: reconcile physical names to the verified binary

For the verified production/rollback SHA, rehearse a scoped rename of the three legacy task tables, the two download/view task-reference columns, and `user_billing.flux_id` to the physical names already expected by that binary. Preserve the existing task IDs, sequences, and billing values. Then explicitly add the missing baseline tables/columns and apply `0002 -> 0003 -> 0004`. Do not create empty replacement task tables or copy rows into an unrelated ID space.

This is the current release candidate because it aligns the database with both the proposed P0 binary and the exact production rollback binary. It is not a declaration that the candidate is deployed or safe: the full baseline, retained historical references, sequence behavior, privileges, and exact Prisma query shapes still require staging evidence. The P0 rollback would switch application deployments while retaining the expanded, renamed schema.

There is no catalog evidence of an internal stored-function, trigger, or view dependency on `flux_*`, and no inbound task foreign key needs retargeting. External consumers and much older Flux binaries remain unknown. Do not invent a compatibility layer solely for hypothetical callers. If a concrete caller still requires the Flux names, add that requirement and its tests before production changes.

The absence of a database-level `UserBilling -> TaskData` foreign key means this repair need not add the Prisma model's `ON DELETE CASCADE`. Historical task/billing IDs can remain linked without introducing new billing-deletion behavior.

## Alternative long-term path: preserve physical table and column names

Keep the logical Prisma names that the application already uses, and map them to the real database objects:

| Logical Prisma element | Physical object to preserve |
| ---------------------- | --------------------------- |
| `TaskData`             | `flux_data`                 |
| `TaskDownloads`        | `flux_downloads`            |
| `TaskViews`            | `flux_views`                |
| `TaskDownloads.taskId` | `flux_downloads.flux_id`    |
| `TaskViews.taskId`     | `flux_views.flux_id`        |
| `UserBilling.taskId`   | `user_billing.flux_id`      |

Prisma's `@@map` and `@map` keep the generated Client API separate from the underlying table and column names. Existing TypeScript calls such as `prisma.taskData.findMany()` and `taskId` can remain logical task names while preserving the existing IDs, sequences, and billing references.

This alternative would first require a dedicated compatibility release and a newly verified rollback target; it cannot be substituted into the current release while claiming the existing `36d7e864` binary remains compatible. The current `0002` and `0004` patches and production preflight target physical `task_data`; they would have to be deliberately updated and reviewed alongside a physical Flux mapping. Do not use a `task_data` view to make an `ALTER TABLE` or `CREATE INDEX` patch appear applicable.

## The baseline needs more than a name fix

`flux_data` lacks these 16 current Prisma columns:

```text
prompt, orientation, principal_id, expires_at, retry_count, idempotency_key,
retention_checked_at, retention_cleaned_at, batch_task_id, batch_index,
r2_url, runninghub_file_name, replicate_status, replicate_urls,
replicate_logs, replicate_metrics
```

Additionally, `user_id`, `replicate_id`, and `aspect_ratio` are `NOT NULL` in the database while the checked-in Prisma model permits null. The Sora2 route creates a task before its external provider ID exists, omits `aspect_ratio`, and permits anonymous ownership. Mapping the table alone would still leave those inserts incompatible. Normal Prisma task queries also select modeled columns, so missing unused columns can still break reads.

Reconcile this on staging through explicit, scoped DDL: nullable additions for optional fields; a reviewed default/backfill for the two text-array fields; a decision to relax the three old nullability constraints or change the corresponding caller contract; and a complete baseline for the missing task/composition/queue tables that the deployed features require. Existing `0000` and `0001` do not form a complete bootstrap chain. Do not execute whole-schema `prisma db push`, a whole-schema diff, or a shared-database reset.

Do not silently add the current `UserBilling.taskData` relation's `ON DELETE CASCADE` foreign key during baseline alignment. It is absent today and would create new billing-deletion behavior. Preserve the current financial-history invariant and review the intended referential action separately before adding or validating a constraint.

## Why a one-step rename is a larger compatibility change

Renaming physical `flux_*` tables to `task_*` can preserve rows and table identity, but it changes the names used by any existing binary or external caller. Legacy compatibility views can expose the former table names and alias `task_id AS flux_id`. The [PostgreSQL 17 CREATE VIEW documentation](https://www.postgresql.org/docs/17/sql-createview.html) explicitly supports `INSERT ... ON CONFLICT DO UPDATE` through automatically updatable views. The view must satisfy the documented conditions, including a single source relation and writable target columns; this support does not extend automatically to arbitrary compatibility views. It still requires integration testing with the exact Prisma version and query shapes used by both binaries.

Views do not solve both generations of `user_billing` code: both generations use the same physical table name, but one expects `flux_id` and the other expects `task_id`. A physical rename of that column breaks the older caller. Keeping both columns would require a reviewed synchronization/backfill/conflict rule and more write-path testing. Replacing the entire billing table with a view introduces further identity, privilege, and tooling changes. Neither is justified merely to rename an internal table.

Any compatibility view would also need `security_invoker=true` and explicit privilege review on the observed PostgreSQL 17 database. A view must not accidentally restore access bypassing base-table RLS. No view or trigger should be created until its precise release purpose and caller allowlist are known.

## Release and rollback sequence

1. Record production deployment `dpl_FrcLQaaH2Wu2YYPbjuRvTeeAui76` and rollback SHA `36d7e86460f837f7369f0caab6b0d62b65a8ce2c` in the release evidence. Inspect and test that binary rather than assuming that an older Flux binary is the rollback target.
2. Prepare the scoped physical-name repair and missing additive baseline separately from the P0 patches. Record their checksums. Do not change unrelated tables or add a billing cascade.
3. On the isolated staging branch, seed synthetic fixtures with historical IDs and linked billing rows. Exercise reads and writes with both the P0 binary and the exact rollback binary. Preserve task IDs, sequence behavior, billing linkage, and per-user filtering; use no provider or production R2 resources. A schema-only clone cannot prove historical-data behavior without these fixtures.
4. Rehearse the baseline and `0002 -> 0003 -> 0004` patches, then run the narrowed preflight, real Prisma reads, lifecycle/callback/download checks, and retention dry-run. Do not treat a synthetic receipt as evidence of production application.
5. Before production baseline DDL, verify a restore point and a narrow resource allowlist. Apply the rehearsed compatible schema first and verify it with the recorded rollback binary. Retain the renamed objects and new columns/tables if the application is rolled back; do not drop schema while either binary may reference it.
6. Deploy P0 only after its independent provider, isolated R2, entitlement, authorization, analytics, and retention gates pass. Keep `TASK_RETENTION_EXECUTE=false` until deletion evidence is accepted.

The exact current rollback binary already expects physical `task_*` names and `user_billing.task_id`. The current rename candidate is therefore compatible in naming with that binary, while a preserved physical Flux mapping would require another baseline release. Neither path is verified for an unspecified historical Flux binary. Do not claim two-generation rollback support based only on automatically updatable views.

## Security scope and remaining blockers

The inspected legacy task/billing tables have broad `anon` and `authenticated` grants; all except `background_removal_tasks` have RLS disabled, and no policies were found in the inspected allowlist. This application uses server-side Prisma and NextAuth; no browser Supabase client use was found in the searched application paths. That is evidence for a server-only task access design, but is not proof that no external consumers exist.

Apply a reviewed server-only access policy to newly created Remove Anything tables before exposing them. Existing table privilege/RLS repair needs its own tested allowlist and caller-impact check. Do not enable RLS across the shared database or alter the unrelated `public."user"` table as part of this migration.

Unresolved release blockers are verification of the exact current production/rollback binary against the repaired staging baseline, a reviewed compatibility implementation and full additive baseline, isolated Preview credentials and R2/provider resources, synthetic historical-data rehearsal, provider/callback/download acceptance, physical/provider deletion evidence, and the remaining OpenSpec release gates. This audit performed only reads and created this local plan; a separate agent is responsible for any staging rehearsal mutations.

## Documentation checked

- [Prisma database mapping](https://www.prisma.io/docs/orm/prisma-schema/data-model/database-mapping)
- [PostgreSQL 17 CREATE VIEW](https://www.postgresql.org/docs/17/sql-createview.html), especially automatically updatable views and `security_invoker`
- [Supabase working with branches](https://supabase.com/docs/guides/deployment/branching/working-with-branches), including branch isolation and separate credentials
- [Supabase changelog](https://supabase.com/changelog.md), checked 2026-10-19

# Staging Prisma and Preview runtime evidence

Date: 2026-10-26 (Asia/Shanghai). Scope: authorized Supabase preview branch and Vercel Preview deployment only.

## Current recheck — 2026-10-26

- Latest Preview deployment: `dpl_9wrHh79MTx6PKgN28hkAQd1iF2zd`, `READY`.
- Deployment alias: `remove-anything-6s2qmbwyi-giantclams-projects.vercel.app`.
- Recheck snapshot before the latest watermark rerun: `task_data=4`, `background_removal_tasks=15`, `object_removal_tasks=2`, `watermark_removal_tasks=4`, `analytics_events=12`; the latest rerun added watermark task `7` and its namespaced durable receipt.
- Real successful task records currently include background `7/13/14`, object `1/2`, watermark `1/4/7`, and Sora2 `task_data.id=4`. The Sora2 result still needs an application download using its matching anonymous principal cookie and byte-level MP4 verification.
- Namespaced analytics receipts currently include `result_downloaded:task:remove-watermark:4/7` and `result_downloaded:task:sora2-video-watermark-removal:4`, plus the background/object receipts listed in `implementation-evidence.md`.

### P0 table security observation

A read-only SQL recheck against staging found the following current Data API boundary:

| Table | RLS | `anon` / `authenticated` grants | Policies |
| --- | --- | --- | --- |
| `task_data` | disabled | full table DML grants | none |
| `object_removal_tasks` | disabled | full table DML grants | none |
| `background_removal_tasks` | enabled | full table DML grants | none |
| `watermark_removal_tasks` | enabled | no client grants | none |
| `analytics_events` | enabled | no client grants | none |

This observation was remediated for the P0 tables by staging migration `20261026135812 remove_anything_p0_staging_task_rls_hardening`: RLS is enabled on all five tables and `anon`/`authenticated` table and sequence grants are revoked. A fresh read-only query confirmed no client grants and RLS enabled on every P0 table. Unrelated inherited tables on the shared branch still produce Supabase advisor findings and remain outside this P0-scoped change.

Supabase migration history records `20261026135812 remove_anything_p0_staging_task_rls_hardening` on the staging target.

## Staging target and schema repair

- Supabase parent project: `ofmwvapsmsokwvqhwhtf`.
- Supabase branch: `remove-anything-p0-staging`.
- Staging database ref: `pqrfvwgldarfbcfdxave`.
- The branch CLI supplied the staging pooler URLs. Prisma verification used the IPv4 shared pooler, transaction mode on port 6543 with `pgbouncer=true`, and session mode on port 5432 for the direct URL. No password or connection string was recorded here.
- A read-only schema check found `audit_expires_at` missing from `task_data` and `background_removal_tasks`; `watermark_removal_tasks` and `object_removal_tasks` already had the field. This matched the earlier Prisma `P2022` failures.
- A staging-only additive transaction then added the two missing columns, backfilled null values, applied the reviewed 90-day defaults, and created the four audit-expiry indexes. It asserted `current_database()='postgres'`, `current_user='postgres'`, and zero rows in all four task tables before changing schema. It did not run `supabase db push`, did not touch the production ref, and did not create a migration ledger entry.
- Source migration reference: `db/migrations/0005_task_audit_retention.sql`, SHA-256 `bd390d7e671d9b7f92a32675085376530bf94447bfaec62210ccf2e424683ff0`.
- Post-migration read-only verification found all four audit columns and all four audit-expiry indexes; public application row count remained zero.
- The Supabase CLI also returned a critical `rls_disabled` advisory for 153 inherited `public` tables, including application tables exposed to `anon`/`authenticated`. No bulk remediation was applied: enabling RLS without reviewed per-table policies would block legitimate access and could change unrelated shared applications. This remains a separate staging security/release blocker.

## Prisma/application compatibility

- `npx --yes prisma@6.17.1 migrate status --schema prisma/schema.prisma` returned `Database schema is up to date!` through the staging pooler.
- A real `@prisma/client` 6.17.1 read-only probe returned `ok-empty-result` for `taskData`, `backgroundRemovalTask`, `watermarkRemovalTask`, `objectRemovalTask`, `processingQueue`, `backgroundImage`, `backgroundComposition`, and `analyticsEvent` using nonexistent IDs/event IDs.
- The same probe returned database `postgres`, user `postgres`, schema `public`, and PostgreSQL `17.11`.
- This closes the staging Prisma column/transport compatibility check. It does not prove rollback under populated data, provider/storage execution, or production compatibility.

## Vercel Preview runtime

- Deployment: `dpl_HV8htcPuJxx3QUoAzz1meAUS6du3`.
- Target: Preview, status `READY`.
- Protected requests made with `vercel curl` reached the deployment's function routes:
  - `GET /api/background-images` → HTTP 200 with an empty staging list.
  - `GET /api/task-queue/status` → HTTP 200, `0/4` active and empty queue.
  - `GET /api/user/credit` → HTTP 401 for an unauthenticated request.
  - `GET /api/remove-objects` → HTTP 405, confirming the route reached its method guard.
- Vercel request logs identified these responses as `environment=preview` on the target deployment. The protected runtime is now reachable and serving the expected route boundaries; a runtime endpoint exposing the database project fingerprint is still intentionally absent, so the exact Vercel database ref is inferred from the branch-specific secret configuration rather than returned by the application.

## Remaining release gates

The OpenSpec change remains in progress at 39/56 tasks complete. Open gates still include real provider and R2 public/private delivery acceptance, cost approval, complete browser/provider flows, durable analytics receipt and recovery, GSC/GA4 authenticated evidence, physical retention and deletion, purchase reconciliation, rollback/isolation acceptance, the 28-day baseline, and the P1 expansion gate.

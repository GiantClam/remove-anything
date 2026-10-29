# Supabase staging branch read-only verification — 2026-10-21

This record is read-only evidence for the isolated integration environment. No
production database, production storage bucket, provider, payment endpoint, or
retention execution path was touched.

## Boundary

- Parent Supabase project: `remove-anything` (`ofmwvapsmsokwvqhwhtf`)
- Branch: `remove-anything-p0-staging`
- Branch project ref: `pqrfvwgldarfbcfdxave`
- Branch status: `FUNCTIONS_DEPLOYED`, `ACTIVE_HEALTHY`, `with_data=false`
- The branch is not connected to the Vercel Preview deployment yet.

The branch database reported PostgreSQL 17.11 and approximately 23 MB. The
management API lists six branch migrations, including the remote schema,
baseline rehearsals, and durable analytics migration. The database's
`_prisma_migrations` table currently contains zero rows, so Prisma migration
receipt compatibility still requires an application-level acceptance run.

## P0 schema presence

All nine target tables are present: `task_data`, `background_removal_tasks`,
`object_removal_tasks`, `watermark_removal_tasks`, `batch_tasks`,
`processing_queue`, `background_images`, `background_compositions`, and
`analytics_events`. The target indexes and the P0 retention/idempotency columns
are present in the branch schema.

## Security finding

The read-only catalog query showed RLS enabled on
`analytics_events`, `background_compositions`, `background_images`,
`background_removal_tasks`, `batch_tasks`, `processing_queue`, and
`watermark_removal_tasks`. RLS is disabled on `task_data` and
`object_removal_tasks`; both also have full table ACLs for `anon` and
`authenticated` in this branch.

Supabase security advisors report 153 public tables with RLS disabled, many of
which belong to other applications sharing the parent project schema. This is
a staging security blocker for public/Data API access. It must not be repaired
with a blanket `ENABLE ROW LEVEL SECURITY` operation because enabling RLS
without application-specific policies would block existing applications. The
release path must either use a dedicated Remove Anything database/project or
apply reviewed per-table policies and ACLs before any public client acceptance.

## Consequence

The branch is suitable for the next server-side integration steps only after
Vercel is configured with the branch connection and an independent R2 bucket,
and only through server-side Prisma/service-role paths. It is not evidence that
public anonymous/authenticated Supabase Data API access is safe. No OpenSpec
task is marked complete from this read-only check alone.

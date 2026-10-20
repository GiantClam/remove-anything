# Production schema post-cutover audit

Reviewed: 2026-10-20 (UTC/Asia/Shanghai). Target Supabase project: `ofmwvapsmsokwvqhwhtf`.

The Supabase migration ledger records the applied migrations `20261020144555 remove_anything_p0_production_baseline_reconciliation` and `20261020170341 remove_anything_durable_analytics_events`. The local receipt for this result is [production-migration-receipt.json](./production-migration-receipt.json). The receipt is bound to the reviewed production target fingerprint and the current `0007_production_baseline_reconciliation.sql` and `0008_durable_analytics_events.sql` checksums.

Read-only postchecks returned:

- PostgreSQL `17.4`.
- All 25 Prisma models represented in `prisma/schema.prisma` were present with all 307 mapped columns present and compatible by PostgreSQL scalar/array type and nullability.
- All 13 mapped Prisma indexes were present, valid, ready, btree, and had the expected column order.
- The 19 expected database foreign keys were present and compatible. The one Prisma relation intentionally excluded from this count is `user_billing.task_id -> task_data.id`; the compatibility plan preserves the historical link without introducing a new billing deletion cascade.
- The five server-only tables (`batch_tasks`, `watermark_removal_tasks`, `processing_queue`, `background_images`, and `background_compositions`) all had RLS enabled, with no `anon`, `authenticated`, or `PUBLIC` table privilege leaks.
- The old `flux_data`, `flux_downloads`, and `flux_views` objects were absent. `task_data.replicate_urls` and `task_data.replicate_logs` had zero null rows, and non-null billing task references had zero orphans.
- Business row counts were preserved: `users` 344, `task_data` 253, `task_downloads` 0, `task_views` 0, `background_removal_tasks` 252, `object_removal_tasks` 44, `user_billing` 188. Newly created queue, watermark, background-library, and composition tables were empty.
- The additive `analytics_events` table has all 18 columns, three expected btree indexes, `timestamp(3)` event/creation timestamps, RLS enabled, and no `PUBLIC`, `anon`, or `authenticated` DML privileges. A transaction-scoped duplicate probe inserted the same `event_id` twice and observed one row before rollback; the table remained empty afterward and the four existing task-table counts remained 253, 252, 44, and 0.

The scoped table/index inventory is read-only evidence from Supabase and is independent of local SQL fixtures. It does not prove exact Prisma transport, provider callbacks, R2 policy, queue execution, retention deletion, payment reconciliation, or analytics receipt. A local Prisma read through the pooler reproduced a prepared-statement incompatibility; the direct Supabase host was unreachable from this workstation. Those application-path checks remain release gates.

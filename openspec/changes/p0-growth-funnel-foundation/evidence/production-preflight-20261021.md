# Production preflight evidence

Observed: 2026-10-21 (Asia/Shanghai). The check was read-only. Environment values and database rows were not written to this file.

The preflight was run after loading the repository dotenv files in Node, with the reviewed migration receipt at `evidence/production-migration-receipt.json`. The first connection attempt returned the fixed category `database read failed (connection)`. A retry completed with `Database: OK`, verified the target fingerprint and both recorded migration checksums, and found no schema, index, migration-ledger, RLS, or client-ACL blockers.

The four audit-expiry defaults were independently queried from `information_schema.columns` and `pg_attrdef`:

| Table | PostgreSQL expression |
| --- | --- |
| `task_data` | `(CURRENT_TIMESTAMP + '90 days'::interval)` |
| `background_removal_tasks` | `(CURRENT_TIMESTAMP + '90 days'::interval)` |
| `watermark_removal_tasks` | `(CURRENT_TIMESTAMP + '90 days'::interval)` |
| `object_removal_tasks` | `(CURRENT_TIMESTAMP + '90 days'::interval)` |

This is PostgreSQL's normalized representation of the reviewed `(CURRENT_TIMESTAMP + INTERVAL '90 days')` expression in the migration and Prisma schema. The preflight now normalizes only this narrow equivalent form and continues to reject a different interval; the regression suite covers both cases.

The preflight remains blocked by missing or placeholder runtime configuration: production site/auth URLs and Google client credentials, the RunningHub detect workflow and approved output prefixes, task header and webhook secrets, Stripe API/webhook secrets, and the Replicate token. These are configuration and acceptance gates; no provider job, payment, storage mutation, retention execution, or deployment was attempted.

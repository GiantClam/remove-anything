# Staging Supabase CLI read-only verification — 2026-10-27

The Supabase CLI (`2.122.0`) was used against the isolated staging project ref `pqrfvwgldarfbcfdxave`. No production project was queried and no write, migration, or storage mutation was issued during this pass.

The target query returned database `postgres`, role `postgres`, and PostgreSQL `17.11`. The remote migration list includes `20261019080640`, `20261019083915`, `20261019084126`, `20261019084427`, `20261019095055`, `20261020164809`, and `20261026135812`.

The five P0 tables all returned `rls_enabled=true`; `has_table_privilege` returned `false` for both `anon` and `authenticated` SELECT on every table:

| Table | RLS | anon SELECT | authenticated SELECT |
| --- | --- | --- | --- |
| `analytics_events` | enabled | denied | denied |
| `background_removal_tasks` | enabled | denied | denied |
| `object_removal_tasks` | enabled | denied | denied |
| `task_data` | enabled | denied | denied |
| `watermark_removal_tasks` | enabled | denied | denied |

The same read-only snapshot reported `task_data=4`, `background_removal_tasks=22`, `object_removal_tasks=2`, `watermark_removal_tasks=7`, and `analytics_events=16`. Namespaced download receipts include `result_downloaded:task:remove-background:20`, `result_downloaded:task:remove-background:22`, `result_downloaded:task:remove-watermark:7`, `result_downloaded:task:sora2-video-watermark-removal:4`, and `result_downloaded:task:remove-objects:1/2`. Older numeric-only receipts remain historical rows and are not treated as current collision-free evidence.

This proves the staging control-plane readback and application analytics records only. It does not prove an exact Prisma binary connection, serializable mutation/concurrency behavior, rollback-under-data, R2 control-plane policy, provider callback delivery, payment reconciliation, or production retention execution. Those gates remain open.

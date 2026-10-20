# Production application-path compatibility probes

Observed: 2026-10-20 16:19 UTC / 2026-10-21 00:19 Asia/Shanghai. All probes were read-only and used random task IDs that were not created or written.

- `GET /api/remove-objects/compatibility-probe-20261021?dbOnly=true` returned HTTP 404 `Task not found` through the object-removal Prisma query.
- `GET /api/task/compatibility-probe-20261021?dbOnly=true` returned HTTP 404 `Task not found` through the background-removal Prisma query.
- `GET /api/auth/session` returned `{}` without a session.
- `GET /api/account` returned HTTP 401 `Not authenticated`.
- `GET /api/task-queue/status` returned HTTP 200 with `running=0`, `pending=0`, `waiting=0`, and `maxConcurrent=4`.
- `GET /api/mine-tasks` returned HTTP 401 `Not authenticated`.

The two random-ID 404 responses demonstrate that the deployed application can query the reconciled production task tables through its Prisma runtime without a schema or transport error. They do not prove mutations, serializable reservation conflicts, rollback, provider callbacks, R2 access, or retention execution.

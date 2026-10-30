# Preview isolation status — 2026-10-30 (Asia/Shanghai)

Authority: t48u residuals. Read-only Vercel project env inventory for `remove-anything` (`prj_9X3ICIUe9uySnVf7YaiOnmTRf4KL`). **No secret values recorded.**

## Method

- `filter_project_envs` with decrypt=false.
- Compared env **keys**, targets (`production` / `preview` / `development`), and gitBranch overrides.
- Branch of interest from `environment-setup.md`: `codex/p0-growth-funnel-foundation-preview`.

## Findings

### Dedicated Preview branch overrides exist

Branch `codex/p0-growth-funnel-foundation-preview` has Preview-targeted entries (separate config ids from Production) for at least:

- `DATABASE_URL`, `DIRECT_URL`, `POSTGRES_URL_NON_POOLING`
- `R2_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_URL_BASE`
- `CRON_SECRET`, `TASK_HEADER_KEY`, `TASK_RETENTION_EXECUTE`

This matches the intended staging isolation path in `environment-setup.md`.

### Default Preview still shares Production-scoped resources

Several variables are configured for the combined target `development,preview,production` **without** a gitBranch, so non-override Preview deployments still inherit Production-adjacent values:

| Key | Shared triple target? | Risk |
| --- | --- | --- |
| `R2_BUCKET` | yes (plus branch override) | Default Preview can write/read prod public bucket |
| `R2_URL_BASE` | yes | Same public locator host |
| `R2_ACCOUNT_ID` / `R2_ENDPOINT` | yes | Same R2 account endpoint |
| `NEXT_PUBLIC_GA_ID` | yes | Preview traffic pollutes production GA4 funnel |
| `RUNNINGHUB_API_KEY` | yes | Preview jobs consume production RH coins |
| `CRON_SECRET` | yes (plus branch override) | Default Preview cron auth aligned with prod |

`R2_PRIVATE_BUCKET` is Production + branch Preview override only (not on the shared triple).

`STRIPE_WEBHOOK_SECRET` has separate Production vs Preview/Development entries (good). `TASK_RETENTION_EXECUTE` / cancel flags are Production (and branch Preview execute entry) — default Preview should keep execute false per runbook.

### DATABASE_URL

Only Preview branch-specific `DATABASE_URL` rows appeared in the env list. Production DB may be supplied via integration linkage not listed the same way; **do not treat absence of a Production `DATABASE_URL` row as isolation proof.** Branch Preview has its own `DATABASE_URL` / `DIRECT_URL` ids distinct from Production `DIRECT_URL`.

## Acceptance vs tasks.md item

| Criterion | Status |
| --- | --- |
| Staging branch Preview can point at separate DB + R2 | **PARTIAL PASS** (overrides present) |
| All Preview deployments isolated from prod DB/storage/GA/RH | **FAIL / OPEN** (shared triple-target envs) |
| Independent verification after redeploy that live Preview hits staging DB/bucket | **OPEN** (needs authenticated Preview probe on that branch) |

## Recommended next steps (not done this turn)

1. Move shared triple-target secrets to Production-only where safe; give default Preview its own GA stream, RH test key, and staging R2 bucket.
2. Redeploy `codex/p0-growth-funnel-foundation-preview` and prove DB/R2 identity differs from Production with read-only probes.
3. Keep `TASK_RETENTION_EXECUTE=false` on all Preview targets unless explicitly testing against staging data.

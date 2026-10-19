# Isolated staging and release credentials

Checked on 2026-10-19. Production runs on Vercel; the optional Cloudflare Worker workflow is a separate staging deployment. A Worker API token does not resolve the Vercel database or storage gates.

## Verified environment boundary

- Current production deployment: `dpl_FrcLQaaH2Wu2YYPbjuRvTeeAui76`, Git SHA `36d7e86460f837f7369f0caab6b0d62b65a8ce2c`, `READY`.
- The earlier Vercel Preview uses the same database and R2 configuration as production, with no branch override. Do not run tasks, callbacks, cron, retention, or migrations through that Preview.
- The isolated Supabase branch is `remove-anything-p0-staging`, project ref `pqrfvwgldarfbcfdxave`. It is not connected to Vercel yet. Its database must never be merged automatically into the shared production project.
- A fresh Vercel production environment export contains R2 object credentials and `R2_ACCOUNT_ID`, but not `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID`. The existing R2 credentials returned HTTP 403 `AccessDenied` for `ListBuckets`; this does not establish whether an individual bucket can be read or written, and does not establish permission to create staging resources.

No environment values or secrets belong in this document, a PR, logs, or chat. Configure secrets directly in the service dashboard or through an authenticated secret-management command.

## R2 setup needed for Vercel staging

1. Open Cloudflare **R2 object storage → Overview** and select the same account as the existing `R2_ACCOUNT_ID`.
2. Create a new bucket named `remove-anything-storage-staging` if it does not already exist. Keep its public `r2.dev` URL and public custom domains disabled. Do not change the existing production bucket or its public policy during this step.
3. Open **Manage API Tokens → Create Account API token** (or **Create User API token** if account-owned tokens are unavailable). Select **Object Read & Write** and restrict the token to this staging bucket. Save the displayed **Access Key ID** and **Secret Access Key** directly into branch-specific Vercel Preview settings as `R2_ACCESS_KEY` and `R2_SECRET_KEY`.
4. Set branch-specific `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ENDPOINT`, and the application's internal object-address base `R2_URL_BASE`. The base is used as an object locator; configuring it does not require making the bucket publicly accessible. Verify signed server reads and provider input delivery separately before running jobs.
5. If an automated provisioner must create or configure buckets, use a separate, temporary **Admin Read & Write** R2 token for that operation. Runtime code only needs the bucket-scoped object token. The current object token must not be treated as a Cloudflare control-plane API token.

Official reference: [R2 authentication and permission table](https://developers.cloudflare.com/r2/api/tokens/), checked 2026-10-19.

## Vercel Preview isolation

In **Vercel → remove-anything → Settings → Environment Variables**, create **Preview / branch-specific** values for `codex/p0-growth-funnel-foundation-preview`:

| Setting                                                               | Staging source                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`, `POSTGRES_URL_NON_POOLING`              | Staging branch connection settings; verify project routing identity as well as hostname |
| All `R2_*` storage settings                                           | Dedicated staging bucket and bucket-scoped credentials                                  |
| `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`                                | The stable staging application origin                                                   |
| `NEXTAUTH_SECRET`, `CRON_SECRET`, `WEBHOOK_SECRET`, `TASK_HEADER_KEY` | Independent staging secrets and matching sender configuration                           |
| `NEXT_PUBLIC_GA_ID`                                                   | A dedicated staging/test stream, kept separate from production funnel evidence          |
| `RUNNINGHUB_API_KEY`, `REPLICATE_API_TOKEN`                           | A dedicated test account/key where available, with an approved test budget              |
| Stripe key and signing secret                                         | Stripe test mode and the staging webhook destination                                    |
| `TASK_RETENTION_EXECUTE`                                              | `false`; the application also blocks execution pending the retention fixes              |

The production environment currently lacks `RUNNINGHUB_OBJECT_DETECT_WORKFLOW_ID`, `RUNNINGHUB_OUTPUT_URL_PREFIXES`, `TASK_HEADER_KEY`, and `STRIPE_WEBHOOK_SECRET`. Detection needs a real workflow with the configured node mapping. Output prefixes must be verified against actual approved provider origins and paths; do not use a broad guessed prefix. The two segment/remove workflow IDs have code defaults, which still need provider acceptance. `CLOUDFLARE_AI_GATEWAY_TOKEN` is not read by the current Vercel AI Gateway implementation and must not be provisioned solely to satisfy an old deploy script.

RunningHub callbacks are optional; polling mode is supported. If callbacks are enabled, use a separate `RUNNINGHUB_WEBHOOK_SECRET` of at least 32 characters and verify delivery to the protected Preview. Do not disable Deployment Protection merely to run read-only checks; `vercel curl` supports authenticated protected deployment requests. Real external callbacks need an explicitly tested delivery path.

After all overrides are in place, redeploy Preview and independently verify that its database target and bucket differ from production. A successful build does not prove that existing deployments use the new variables. Keep all side-effect tests disabled until isolation is confirmed.

## Optional Cloudflare Worker CI

This is not required to publish the Vercel application. If retaining the Worker staging experiment:

1. In Cloudflare **Account API tokens → Create Token**, select **Edit Cloudflare Workers**, then restrict access to the intended account.
2. For an existing `remove-anything-staging` Worker, grant **Workers → Editor** scoped to that Worker. Creating a new Worker requires **Workers product → Admin**; alternatively create it in the dashboard, then use the narrower Editor token for CI.
3. Only when changing a Route or Custom Domain, add **Zone → Workers Routes → Write** for the affected zone. This workflow currently uses no route or custom-domain changes.
4. Direct provisioning/access of KV, D1, or R2 requires the corresponding resource permissions. Binding an existing resource during Worker deployment does not itself require direct resource data permissions.
5. In **GitHub → GiantClam/remove-anything → Settings → Environments**, create/select **staging**. Save the API token as `CLOUDFLARE_API_TOKEN` and the verified account ID as `CLOUDFLARE_ACCOUNT_ID` in that environment's secrets. The account ID is available from the Cloudflare account dashboard; it is not a separately issued secret. Do not put a Worker deployment token into Vercel runtime variables.
6. Replace the staging KV and D1 placeholders in `wrangler.toml` with provisioned staging resource IDs before dispatching the workflow. Adding credentials alone cannot make the current placeholder configuration deployable.

Official references: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) and [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/), checked 2026-10-19.

## Production release boundary

The database baseline requires a scoped repair preserving 253 historical task IDs and 65 billing references. See `baseline-compatibility-plan.md` and `staging-migration-evidence.md`. The shared database must not receive whole-schema `prisma db push`, reset, or a merge of this experimental branch.

Isolated resources, complete baseline/rollback tests, real provider/storage/callback acceptance, entitlement and composition authorization, retention, payment, and measurement evidence remain release gates in `tasks.md`. No production SQL receipt may be generated from a staging rehearsal. Existing user authorization covers progressing through verification and deployment; the unresolved gates are technical evidence and missing environment setup.

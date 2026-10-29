# External gate audit — 2026-10-26

Scope: Vercel Preview deployment `dpl_BuGz9Efbc3BAu3Z6K4RbobcYUfbm` for the real output checks, followed by current Preview deployment `dpl_9YHQXLiPPA6ZYHQdRWFZXELbi8iD` for the analytics hardening commit, the authorized Supabase staging target `pqrfvwgldarfbcfdxave`, and read-only provider/configuration checks. Production was not modified.

## Preview deployment and environment configuration

- Preview deployment is `READY`; protected `GET /remove-watermark` returned HTTP 200.
- The Preview environment export contains runtime R2, RunningHub, Stripe, callback, and database variable names. Secret values were not recorded.
- `STRIPE_API_KEY` is configured with a live-mode `sk_live_` prefix. `STRIPE_WEBHOOK_SECRET` was not present in the Preview environment export. This is a release blocker: staging purchase reconciliation must use Stripe test mode and a configured test webhook secret; the live key must be removed from Preview before further payment testing.
- `RUNNINGHUB_WEBHOOK_SECRET` was not present in the Preview environment export. `RUNNINGHUB_OUTPUT_URL_PREFIXES` is configured. A protected POST to `/api/webhooks/runninghub?key=invalid` returned the fail-closed response `RunningHub callback authentication is unavailable`; provider callback delivery is therefore not accepted and polling remains the only verified completion path.
- A protected POST to `/api/webhooks/task?key=invalid` returned `Invalid task callback key`, confirming the route-level authentication boundary without performing a mutation.
- A protected POST to `/api/webhooks/stripe` without a signature returned `Missing Stripe signature`; this verifies the early boundary only and does not prove a valid test-mode Stripe secret or fulfillment receipt.

## GSC and GA4

- Existing evidence verifies the production GA4 loader, a collection request, and an initial Realtime `page_view`/`session_start` receipt.
- No authenticated GA4 DebugView receipt for the complete tool → processing → download → paywall → checkout/signup chain was available in the connected tools.
- No authenticated Google Search Console property-verification or impressions receipt was available. DNS visibility alone does not close this gate.

These gates require the account owner to complete the authenticated Google UI/API steps and export a dated receipt. They cannot be closed by a staging-only code or SQL check.

## R2 policy and private storage

- Real staging outputs have been downloaded through signed private R2 paths for background, object, watermark, transparent PNG, and Sora2 flows.
- The Vercel environment export redacts `R2_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_ENDPOINT`, `R2_URL_BASE`, and `R2_ACCOUNT_ID`; the control-plane bucket policy and token scope cannot be independently proved from the application path.
- Bucket policy acceptance still requires a Cloudflare R2 readback showing separate public/private bucket identities, public access disabled, and a bucket-scoped runtime token. Do not use the live Stripe or production credentials for this check.

## Prisma mutation, rollback, and concurrency

- Supabase staging migration history contains the reviewed schema rehearsals and the P0 RLS hardening migration.
- Current local Prisma CLI recheck is blocked by the local shell lacking `DIRECT_URL`; the earlier staging pooler compatibility evidence remains valid for read-only transport.
- No fresh exact Prisma mutation, serializable reservation contention, rollback-under-populated-data, or cross-instance queue test was run in this audit. These remain integration gates because a read-only query or SQL rehearsal does not prove application binary behavior.

## Stripe and callback release action

Manual actions required before these gates can close:

1. Replace the Preview `STRIPE_API_KEY` with a Stripe test-mode key and configure `STRIPE_WEBHOOK_SECRET` from a test-mode endpoint.
2. Configure a separate `RUNNINGHUB_WEBHOOK_SECRET` of at least 32 characters and verify callback delivery against the protected staging endpoint, or explicitly keep polling-only mode and mark callback acceptance deferred.
3. Re-read Vercel Preview variable names and run one test-mode purchase/webhook reconciliation in staging; do not use production payment credentials.

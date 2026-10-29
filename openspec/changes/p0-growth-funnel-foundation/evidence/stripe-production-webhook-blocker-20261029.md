# Production STRIPE_WEBHOOK_SECRET — blocker

Observed: 2026-10-29 23:35 Asia/Shanghai (CST, UTC+8).

## Attempt

Tried to create/list a live-mode Stripe webhook endpoint for `https://www.remove-anything.com/api/webhooks/stripe` via Stripe CLI without inventing a secret.

## Result

**Blocked.**

1. `vercel env ls` shows `STRIPE_WEBHOOK_SECRET` only on **Preview** and **Development**. Production target has `STRIPE_API_KEY` (`sk_live_` prefix observed earlier) but **no** `STRIPE_WEBHOOK_SECRET` row.
2. `stripe get /v1/webhook_endpoints --live` returns: live mode API key needs to be re-configured; run `stripe login` to re-authenticate. Current Stripe CLI project is the sandbox profile used for Preview test keys (`shpitto-acceptance-20261020 sandbox`), not a live-mode session.
3. Per policy: do not invent `whsec_` values; do not pull Production live secrets into chat; do not enable `TASK_RETENTION_EXECUTE`; do not enable paid for other tools.

## What the account holder must do

Either:

- Run `stripe login` (live mode) on the Mac, create a live webhook endpoint pointing at `https://www.remove-anything.com/api/webhooks/stripe` for the required checkout/invoice events, then paste the resulting `whsec_…` into Vercel Production `STRIPE_WEBHOOK_SECRET` (or confirm Dashboard creation and authorize the agent to set the env from the Dashboard value without printing it), **or**
- Create the endpoint in Stripe Dashboard (live) and provide/authorize setting the signing secret into Production only.

After the secret is set and Production redeploys, a signed live webhook smoke (not a paid live charge unless separately approved) can close live purchase canary prerequisites.

## Secrets

None recorded in this evidence file.

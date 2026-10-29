# Production STRIPE_WEBHOOK_SECRET — configured

Observed / completed: 2026-10-29 ~23:46 Asia/Shanghai (CST, UTC+8).

## Result

**Unblocked.** Production now has live Stripe webhook signing secret wired.

## What changed

1. Used Production Vercel `STRIPE_API_KEY` (`sk_live_` prefix only; value not recorded here) to manage live webhook endpoints.
2. Existing live endpoint `we_1RshmkE1IVntRznJLVZKPYzF` for `https://www.remove-anything.com/api/webhooks/stripe` only subscribed to subscription/invoice events (no checkout). It was **disabled and deleted**.
3. Created live endpoint **`we_1UVvXfE1IVntRznJHXOS1K11`**:
   - URL: `https://www.remove-anything.com/api/webhooks/stripe`
   - `livemode: true`, `status: enabled`
   - Events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Upserted Vercel Production env `STRIPE_WEBHOOK_SECRET` (id `dZ5IIEoFEMnU8kn3`, type sensitive). Secret value not recorded.
5. Redeployed Production so serverless runtime picks up the env: `dpl_EYhMrvNbhtoCwkh8ebsEGxN3Dfmc` (from prior READY `dpl_4AQVqMqD…` @ `f37c8ba`).
6. `TASK_RETENTION_EXECUTE` remains **`false`** on Production.

## Stripe CLI live login

Owner confirmed live CLI pairing (`lucky-feisty-oasis-excels`), but the non-interactive `--complete` poll URL had expired before completion (`Live mode key: not available` on sandbox profile). Work proceeded with Production live API key instead of inventing a secret.

## Smoke (no live charge)

After Production redeploy `dpl_EYhMrvNbhtoCwkh8ebsEGxN3Dfmc` **READY** (aliases include `www.remove-anything.com`):

- Unsigned POST `/api/webhooks/stripe` → **400** `Missing Stripe signature` (boundary).
- Synthetic signed POST (`checkout.session.expired`, header via project `stripe` SDK `generateTestHeaderString` + Production `whsec_`) → **200** `Webhook processed successfully`.
- No live charge / Checkout Session created.

## Out of scope / still closed

- No live paid charge / purchase canary in this step.
- Other tools remain `paidEnabled: false`.
- Retention execute remains off.
- Secrets not written to evidence or chat.

## Secrets

None recorded in this evidence file.

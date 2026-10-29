# Stripe Preview test-key cutover — complete (2026-10-29 CST)

## Authorization
- User t32u authorized replacing Preview `STRIPE_API_KEY` with `sk_test_…` and setting test `STRIPE_WEBHOOK_SECRET`.
- User t33u confirmed Stripe CLI browser pairing (`cheery-ideal-thank-lean`).
- Production live keys remain on Production only; `TASK_RETENTION_EXECUTE` stays false (not modified).

## Account / mode
- Stripe CLI authenticated to sandbox **shpitto-acceptance-20261020** (`acct_1USYQxRcvKApiJYW`).
- Key mode: **test** (`sk_test_` / `pk_test_`); webhook `livemode=false`.
- CLI key expiry noted by Stripe (~90 days from login).

## Done
1. **Split env scope** (earlier this day): production-only live `STRIPE_API_KEY` (`id=2T00i4V5PrHrxwuf`).
2. **CLI login completed** after t33u confirmation (`stripe login --complete`).
3. **Created test webhook** `we_1UVrDfRcvKApiJYW2IsiYbQY` → Preview `/api/webhooks/stripe`  
   Events: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.created|updated|deleted`.
4. **Vercel Preview + Development** sensitive envs created:
   - `STRIPE_API_KEY` id=`o0sBIfV7zMXSlyQA` (prefix `sk_test_`)
   - `STRIPE_WEBHOOK_SECRET` id=`AEQf1r9dAYCOdV98` (prefix `whsec_`)
5. **Preview redeploy** `dpl_8XXz1czphTzqz8iQpZyWPM71mBE1` READY  
   Host: `remove-anything-n37inof9k-giantclams-projects.vercel.app`  
   Webhook endpoint URL updated to this host.
6. **Smoke (no live charge)** against Preview (via automation bypass; Deployment Protection blocks anonymous):
   - Unsigned POST → **400** `{"error":"Missing Stripe signature"}`
   - HMAC-signed `checkout.session.expired` (`cs_test_smoke_preview_20261029`) → **200** `{"message":"Webhook processed successfully"}`

## Prefixes only (no secret values)
| Env | Target | Prefix / note |
|-----|--------|----------------|
| STRIPE_API_KEY | production | `sk_live_` (unchanged) |
| STRIPE_API_KEY | preview, development | `sk_test_` |
| STRIPE_WEBHOOK_SECRET | preview, development | `whsec_` |
| STRIPE_WEBHOOK_SECRET | production | still absent |

## Remaining blockers for paid Preview canary
- Sandbox account has **no** remove-anything Price IDs wired to `NEXT_PUBLIC_STRIPE_*_PLAN_ID` (placeholders / live-account prices mismatch).
- Production still lacks `STRIPE_WEBHOOK_SECRET` (out of scope for this Preview cutover).
- Full purchase → webhook fulfill → credit ledger canary not run (needs test prices + Checkout Session).
- Preview Deployment Protection requires automation bypass for HTTP probes.
- `TASK_RETENTION_EXECUTE` / full-res paid delivery remain off by policy.

## Secret handling
- No secret values recorded in this evidence file or git.
- Local CLI material under `.agent-private/` (gitignored).

# Stripe sandbox plan Price IDs — Preview/Development (2026-10-29 CST)

## Authorization
- User t34u「需要」→ create Stripe sandbox Prices aligned to `NEXT_PUBLIC_STRIPE_*_PLAN_ID`, set Preview env, redeploy Preview (test mode only).

## Prices created (livemode=false)
Aligned to `config/subscriptions.ts`:
| Env key | Nickname | Amount | Interval |
|---|---|---|---|
| NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PLAN_ID | pro-monthly-15 | 1500 USD cents | month |
| NEXT_PUBLIC_STRIPE_PRO_YEARLY_PLAN_ID | pro-yearly-144 | 14400 | year |
| NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY_PLAN_ID | business-monthly-30 | 3000 | month |
| NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PLAN_ID | business-yearly-300 | 30000 | year |

ID prefixes only (public `price_` identifiers; full values in Vercel Preview/Development):
- Pro monthly: `price_1UVu88Rc…`
- Pro yearly: `price_1UVu8CRc…`
- Business monthly: `price_1UVu8FRc…`
- Business yearly: `price_1UVu8IRc…`

Products: `prod_VWy4GGkhKv7n4d` (Pro), `prod_VWy4lcwsSgqTh3` (Business).

## Vercel scopes
- Written to **preview** + **development** only (not production).
- Production remains without these sandbox plan IDs.

## Checkout canary note
- `/api/charge-order` credit checkout uses dynamic `price_data` (one-time `mode: payment`), not these subscription Price IDs.
- These PLAN_IDs wire `config/subscriptions.ts` `stripeIds`.
- Preview already has `sk_test_` + webhook; after Preview redeploy, credit checkout canary can run next; subscription Checkout that expects recurring Price IDs would need a code path using `price:` + `mode: subscription` (current adapter is payment-only).

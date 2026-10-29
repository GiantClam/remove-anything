# Preview Stripe credit-purchase canary — 2026-10-29 (Asia/Shanghai)

## Result

**PASS** (test mode only; no live card / no `sk_live_` charge).

| Field | Value |
| --- | --- |
| Preview host | `https://remove-anything-9cct2etn1-giantclams-projects.vercel.app` |
| Deployment | `dpl_7PHYjFdqdjmNwMEctsXYZoCgLoHn` |
| Branch | `codex/p0-growth-funnel-foundation-preview` |
| Stripe key mode | `sk_test_` |
| Product id | `d0a4Ma1MBVwX` (sandbox) |
| User | `canary-credit-20261029` |
| Credits before → after | 10 → **160** (+150) |
| Order | `YkNWdMK5M9Pg` → phase **Paid** |
| Fulfillment | signed `checkout.session.completed` webhook (SDK `generateTestHeaderString` + Preview `whsec_`) |
| Checkout | `cs_test_…`, `livemode: false`, `amount_total: 500` USD |

## Steps (all PASS)

1. Confirm Preview Stripe API key prefix `sk_test_`
2. Upsert canary user + mint NextAuth session
3. `POST /api/charge-order` → Checkout URL on `checkout.stripe.com`
4. Retrieve session (`payment_status=unpaid`, test mode)
5. POST signed webhook to Preview `/api/webhooks/stripe`
6. Poll order Paid + credit ledger delta +150

## Out of scope

- No browser card UI
- No Production live Checkout
- Subscription Price IDs exist on Preview (`evidence/stripe-sandbox-plan-ids-20261029.md`) but subscription Checkout adapter not exercised here

Secrets and raw canary JSON stay under `.agent-private/` (not committed).

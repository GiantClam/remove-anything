# remove-background paid path + full-output gate — 2026-10-29 (Asia/Shanghai)

## Scope

Document and probe the **paid enablement** for `remove-background` without charging live Stripe money and without unlocking full-resolution delivery.

| Gate | State |
| --- | --- |
| `paidEnabled` (registry) | **`true`** for `remove-background` only (PR #13 / t31u cost waiver) |
| `creditCost` / `costApproval.creditCost` | **`2`** (matched) |
| `FULL_OUTPUT_IMPLEMENTATION_ENABLED` | **`false`** in `lib/output-entitlements.ts` |
| Other tools `paidEnabled` | **`false`** (unchanged) |
| `TASK_RETENTION_EXECUTE` | **`false`** (unchanged) |
| Live Stripe Checkout charge | **not** performed this probe |

## Paid path layers (what “paid” does / does not do)

1. **Cost approval + `paidEnabled: true`** — recorded in `evidence/cost-approval-20261029.md`; allows the registry paid flag; does **not** by itself deliver full-resolution bytes.
2. **Credits purchase (Preview, test mode)** — PASS earlier same day: signed `checkout.session.completed` webhook → order `Paid`, credits 10→160. See `.agent-private/credit-purchase-canary-result.redacted.json` (not committed). No live card.
3. **Production webhook** — `STRIPE_WEBHOOK_SECRET` configured; unsigned 400 / synthetic signed 200. See `evidence/stripe-production-webhook-20261029.md`. **No live purchase canary.**
4. **Full-resolution download** — still fail-closed while `FULL_OUTPUT_IMPLEMENTATION_ENABLED === false`, even when the caller is authenticated and the tool is `paidEnabled`.

## Production HTTP probe (no new provider create, no Stripe)

Reuse free canary task `taskId=2115828024200089601` (record `282`, private R2 PNG already downloaded 200 earlier).

| Step | Result |
| --- | --- |
| Principal jar only + default download | HTTP **200**, `image/png`, 418,788 B |
| Principal jar only + `output=full` | HTTP **401** `FULL_OUTPUT_REQUIRES_AUTHENTICATION` |
| Principal jar + minted NextAuth session (`canary-fullgate-20261029`) + `output=full` | HTTP **402** `FULL_OUTPUT_NOT_ENABLED` |
| Same combined cookies + default download | HTTP **200** (preview/low-res path unchanged) |

Bodies (no secrets):

```json
{"error":"Sign in or create an account to request full output","code":"FULL_OUTPUT_REQUIRES_AUTHENTICATION"}
{"error":"Full output is not enabled for this tool yet","code":"FULL_OUTPUT_NOT_ENABLED"}
```

## Unit / suite

`npm test` growth suite on Mac: **401/401 pass**, including `tests/growth/output-entitlements.test.ts` (authenticated full → `FULL_OUTPUT_NOT_ENABLED` / 402) and download-route full-output rejects.

## Conclusion

- **Paid registry enablement for remove-background is live.**
- **Credits can be purchased in Preview test mode.**
- **Full-resolution delivery remains deliberately blocked** by `FULL_OUTPUT_IMPLEMENTATION_ENABLED=false` until a separate implementation review flips that constant.
- Do **not** treat this evidence as closing paid/full delivery, live purchase canary, Retention execute, or other-tool cost approvals.

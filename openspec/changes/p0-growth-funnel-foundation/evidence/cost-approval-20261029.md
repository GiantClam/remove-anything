# Cost approval — remove-background (2026-10-29)

Status: **APPROVED — `paidEnabled: true` for `remove-background` only.** Measured provider/retry/storage USD waived by account holder (t31u).

## Authority

| Field | Value |
| --- | --- |
| Tool | `remove-background` only (related background variants **not** included) |
| Account-holder messages | t30u / Asia/Shanghai 2026-10-29:「批准 remove-background，不限额，完成任务为止」; t31u:「无实测成本也可开启付费」 |
| Approver (`approvedBy`) | liulanggoukk@gmail.com (Product owner / account holder) |
| Approved at (`approvedAt`) | 2026-10-29 |
| Scope of approval | Paid-path cost gate for `remove-background`; commercial per-tool quota/limit reconciliation **waived** per「不限额」; measured USD **waived** per t31u |

This record does **not** approve transparent-png-maker, white-background-maker, change-background-color, batch-remove-background, remove-objects, remove-watermark, or Sora2.

## Registry decision (applied)

| Field | Value | Source |
| --- | --- | --- |
| `creditCost` | `2` | `lib/tool-registry.ts` remove-background entry |
| `costApproval.creditCost` | `2` | Must match `creditCost` |
| `costApproval.approvedBy` | `liulanggoukk@gmail.com` | t30u/t31u account holder |
| `costApproval.approvedAt` | `2026-10-29` | Asia/Shanghai calendar date |
| `costApproval.evidenceReference` | `openspec/changes/p0-growth-funnel-foundation/evidence/cost-approval-20261029.md` | This file |
| `paidEnabled` | `true` | Enabled for `remove-background` only after t31u waiver |
| `limits.retryCreditCost` | `0` | `singleImageLimits` |
| `limits.maxAutomaticRetries` | `1` | `singleImageLimits` |
| Safety limits (`maxFileSizeMb` / `maxPixels` / `maxOutputSizeMb` / `timeoutSeconds`) | 10 / 40_000_000 / 10 / 120 | Decoder / contract safety — **not** removed by「不限额」 |

## Measured USD costs (waived)

Searched on 2026-10-29 (Asia/Shanghai): no measured RunningHub/R2 unit costs found for this tool. Fixtures remain synthetic and are not cost evidence.

| Cost component | Status | Notes |
| --- | --- | --- |
| `provider_cost` (USD / successful task) | **WAIVED — unmeasured** | t31u「无实测成本也可开启付费」authorizes enabling without inventing figures |
| `retry_cost` (USD / automatic retry) | **WAIVED — unmeasured** | Same waiver |
| `storage_cost` (USD / result retention window) | **WAIVED — unmeasured** | Same waiver |
| Currency | USD expected when later measured | ISO-4217 per weekly-report-input-contract |

**Finance/Cost gate:** owner explicitly waived measured USD for this tool only. Registry `costApproval` + `paidEnabled: true` are therefore set for `remove-background` only.

## Limit reconciliation

User waived commercial file/credit/pricing cap checks for this tool (「不限额」). Engineering **did not** remove server safety limits (`maxFileSizeMb`, `maxPixels`, timeout, output size): those remain input-decoder / contract safety and are documented as independent of cost approval in `lib/tool-registry.ts`.

OpenSpec multi-tool cost item remains open for **other** tools; remove-background paid gate is closed by this approval + waiver.

## Separately still blocked (not part of this enable)

1. Full-resolution delivery: `FULL_OUTPUT_IMPLEMENTATION_ENABLED` remains `false` in `lib/output-entitlements.ts`. Cost approval / `paidEnabled` alone does **not** deliver full output; leave that flag false until a separate full-output implementation review.
2. Stripe (independent blocker; **not** authorized to change keys):
   - Preview still audited with live-mode `sk_live_` prefix and missing `STRIPE_WEBHOOK_SECRET` (`evidence/external-gate-audit-20261026.md`). Staging purchase reconciliation needs `sk_test_` + test webhook secret before paid checkout canaries. No secrets recorded or changed in this work.
3. Keep `TASK_RETENTION_EXECUTE=false` (unchanged).
4. Other tools remain `paidEnabled: false` with no `costApproval`.

## Explicit actions this turn

- Recorded t31u waiver of measured provider/retry/storage USD.
- Set `costApproval` + `paidEnabled: true` on `remove-background` only in `lib/tool-registry.ts`.
- Did **not** enable `FULL_OUTPUT_IMPLEMENTATION_ENABLED`.
- Did **not** change Stripe keys or Retention execute.
- Did **not** extend approval to related background tools.

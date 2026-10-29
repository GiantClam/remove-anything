# Cost approval draft — remove-background (2026-10-29)

Status: **PARTIAL — creditCost approved by account holder; USD provider/retry/storage costs UNKNOWN; `paidEnabled` remains false.**

## Authority

| Field | Value |
| --- | --- |
| Tool | `remove-background` only (related background variants **not** included) |
| Account-holder message | t30u / Asia/Shanghai 2026-10-29:「批准 remove-background，不限额，完成任务为止」 |
| Approver | liulanggoukk@gmail.com (Product owner / account holder) |
| Approved at | 2026-10-29 |
| Scope of approval | Paid-path cost gate for `remove-background`; commercial per-tool quota/limit reconciliation **waived** for this tool per「不限额」 |

This record does **not** approve transparent-png-maker, white-background-maker, change-background-color, batch-remove-background, remove-objects, remove-watermark, or Sora2.

## Registry baseline (already configured)

| Field | Value | Source |
| --- | --- | --- |
| `creditCost` | `2` | `lib/tool-registry.ts` remove-background entry |
| `limits.retryCreditCost` | `0` | `singleImageLimits` |
| `limits.maxAutomaticRetries` | `1` | `singleImageLimits` |
| `limits.maxFileSizeMb` / `maxPixels` / `maxOutputSizeMb` / `timeoutSeconds` | 10 / 40_000_000 / 10 / 120 | Safety decoder / contract limits (independent of paid cost approval) |
| `paidEnabled` | `false` | Unchanged — **must stay false** until measured USD costs are recorded |

## Measured USD costs (required; not invented)

Searched on 2026-10-29 (Asia/Shanghai) across Mac repo `remove-anything`, OpenSpec evidence/, weekly report fixtures, docs, canary notes, and owners/requirements:

| Cost component | Status | Notes |
| --- | --- | --- |
| `provider_cost` (USD / successful task) | **UNKNOWN / pending measurement** | No RunningHub invoice, balance burn, or per-task measured cost found for background removal. Weekly report inputs remain `NO DATA` for production costs. Test fixtures (`tests/fixtures/weekly-report/*.json`) contain **synthetic** numbers only and are not approvals. |
| `retry_cost` (USD / automatic retry) | **UNKNOWN / pending measurement** | No measured retry spend recorded. |
| `storage_cost` (USD / result retention window) | **UNKNOWN / pending measurement** | No R2/object storage unit cost tied to 24h result retention for this tool. |
| Currency | USD expected | ISO-4217 per weekly-report-input-contract |

**Finance/Cost gate (owners.md):** paid output is blocked while provider-cost evidence is unknown. This draft therefore **does not** set registry `costApproval` or `paidEnabled: true`.

## Limit reconciliation

User waived commercial file/credit/pricing cap checks for this tool (「不限额」). Engineering **did not** remove server safety limits (`maxFileSizeMb`, `maxPixels`, timeout, output size): those remain input-decoder / contract safety and are documented as independent of cost approval in `lib/tool-registry.ts`.

OpenSpec `tasks.md` item still open until USD fields are filled:

- `[ ] Approve actual provider/retry/storage costs and reconcile each tool's file, pixel, output, timeout, and pricing limits before enabling paid output.`

Partial progress for this tool: creditCost baseline accepted; commercial limit reconciliation waived by owner; USD components still required.

## What remains before `paidEnabled: true` for remove-background

1. Record measured (or owner-explicit) USD:
   - `provider_cost`
   - `retry_cost`
   - `storage_cost`
   - optional margin / credit→USD price acceptance
2. Or account holder explicitly waives measured USD and authorizes open-without-measurement (not given in t30u).
3. Write matching `costApproval` on the registry entry:
   - `creditCost: 2`
   - `approvedBy`, `approvedAt: 2026-10-29`
   - `evidenceReference` → this file (or a superseding measured-cost evidence)
4. Separately implement/enable full-resolution delivery (`FULL_OUTPUT_IMPLEMENTATION_ENABLED` is still `false` in `lib/output-entitlements.ts`). Cost approval alone does not deliver full output.
5. Stripe (independent blocker; **not** authorized by t30u):
   - Preview still audited with live-mode `sk_live_` prefix and missing `STRIPE_WEBHOOK_SECRET` (`evidence/external-gate-audit-20261026.md`). Staging purchase reconciliation needs `sk_test_` + test webhook secret before paid checkout canaries. No secrets recorded or changed in this work.
6. Keep `TASK_RETENTION_EXECUTE=false` (unchanged).

## Explicit non-actions this turn

- Did **not** invent provider/retry/storage USD figures.
- Did **not** set `paidEnabled: true` on any tool.
- Did **not** add `costApproval` to `lib/tool-registry.ts` (would imply a complete cost decision).
- Did **not** change Stripe keys or Retention execute.
- Did **not** extend approval to related background tools.

## Next ask for account holder (minimal)

Reply with measured or accepted USD for remove-background, e.g.:

`remove-background: provider_cost=$X retry_cost=$Y storage_cost=$Z currency=USD margin=accepted`

— or explicitly:「无实测成本也可开启付费」if opening without measurement is intentional.

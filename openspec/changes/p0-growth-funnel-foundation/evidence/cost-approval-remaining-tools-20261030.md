# Cost approval — remaining paid tools (2026-10-30)

Status: **APPROVED — `paidEnabled: true`** for remaining credit-charged tools. Measured provider/retry/storage USD waived by account-holder blanket authorization (t39u).

## Authority

| Field | Value |
| --- | --- |
| Account-holder message | t39u / Asia/Shanghai 2026-10-30:「全部需要验证，允许所有的预算」 |
| Approver (`approvedBy`) | liulanggoukk@gmail.com |
| Approved at (`approvedAt`) | 2026-10-30 |
| Scope | Enable remaining P0 paid gates for verification: remaining-tool `costApproval` + `paidEnabled`, `FULL_OUTPUT_IMPLEMENTATION_ENABLED`, retention (after race review), Production live Checkout canary (minimal), GA4 funnel |

This record extends t30u/t31u remove-background approval. Free converters (`creditCost: 0`) stay unpaid.

## Registry decisions

| Tool | `creditCost` | Notes |
| --- | --- | --- |
| `remove-background` | 2 | Already approved 2026-10-29 |
| `remove-objects` | **2** | Was `null`; set under t39u blanket (same class as background) |
| `transparent-png-maker` | 2 | Registry baseline |
| `white-background-maker` | 2 | Registry baseline |
| `change-background-color` | 2 | Registry baseline |
| `remove-watermark` | 1 | Registry baseline |
| `batch-remove-background` | 2 | Registry baseline |
| `batch-watermark-removal` | 1 | Registry baseline |
| `sora2-video-watermark-removal` | **5** | Was `null`; video heavier than still watermark (1) |

Measured USD (`provider_cost` / `retry_cost` / `storage_cost`) **WAIVED — unmeasured** per t39u「允许所有的预算」and prior t31u precedent. Safety limits (`maxFileSizeMb` / `maxPixels` / timeout / output size) remain.

## Also enabled with this approval wave

1. `FULL_OUTPUT_IMPLEMENTATION_ENABLED=true` with real full-byte delivery via `materializeImage(Zip)Output` on core download routes.
2. Retention execute / live Checkout / GA4 DebugView are separate verification steps after this registry cutover.

## Explicit non-goals in the registry commit

- Does not flip `TASK_RETENTION_EXECUTE` by itself (race-safe path required first).
- Does not charge live Stripe until the live Checkout canary step.
- Does not start the 28-day baseline until gates clear.

# Full output + remaining paid tools enable (2026-10-30)

## Authority
t39u「全部需要验证，允许所有的预算」— approvedBy=liulanggoukk@gmail.com, approvedAt=2026-10-30 (Asia/Shanghai).

## Code changes
1. `FULL_OUTPUT_IMPLEMENTATION_ENABLED=true` in `lib/output-entitlements.ts`.
2. `materializeImageOutput` / `materializeImageZipOutput` deliver uncapped bytes for tier `full` on background / object / watermark download routes; preview still downscales to 1024px edge.
3. Remaining credit-charged tools: `costApproval` + `paidEnabled: true` (see `cost-approval-remaining-tools-20261030.md`). `remove-objects` creditCost=2; `sora2-video-watermark-removal` creditCost=5. Free converters (`creditCost: 0`) stay unpaid.

## Unit verification
Focused growth tests for registry / entitlements / download-object / batch-paid-gate / low-resolution-output: **PASS**.

## Production canary
Filled after deploy (authenticated `output=full` vs preview edge headers).

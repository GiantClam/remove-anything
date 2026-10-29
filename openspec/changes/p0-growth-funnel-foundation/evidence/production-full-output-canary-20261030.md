# Production full-output canary (2026-10-30)

Scope: Production `https://www.remove-anything.com` after [PR #20](https://github.com/GiantClam/remove-anything/pull/20) / deployment `dpl_9xyTgToLu6KSM59dySd83JYMKyzo` (Asia/Shanghai ~01:01–01:05).

Authority: t39u blanket verification budget.

## Setup
- Authenticated canary user `canary-fullout-20261030` (minted NextAuth session; user upserted).
- Input: synthetic PNG **1600×1200**.
- Tool: `remove-background` via `POST /api/generate` → poll `/api/task/{id}` → download.

## Results

| Step | Result |
| --- | --- |
| Create | HTTP 200, `taskId=2115852669305446401` |
| Poll | `succeeded` (attempt 5) |
| Preview download (`preview=1`) | HTTP **200**, PNG **1024×768**, `x-output-max-edge-px: 1024`, 36 747 B |
| Unauthenticated `output=full` | HTTP **401** `ANONYMOUS_PRINCIPAL_REQUIRED` (fail-closed before bytes; owner-scoped task) |
| Authenticated `output=full` | HTTP **200**, PNG **1600×1200**, `x-output-tier: full`, no max-edge header, 41 623 B |

## Verdict
**PASS** — full-resolution delivery unlocked for approved paid tool with auth; preview still capped; unauthenticated full remains blocked.

## Not in this canary
- Retention execute, live Stripe charge, GA4 DebugView chain, other-tool paid downloads (batch/objects/watermark/sora2) — follow-on.

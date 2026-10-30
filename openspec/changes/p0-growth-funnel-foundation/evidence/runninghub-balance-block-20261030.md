# RunningHub create blocked by balance (2026-10-30)

Authority: t39u / t45u continue. Secrets not recorded.

## Symptom
Production `POST /api/generate` returned HTTP 503 `TASK_CREATION_OUTCOME_UNKNOWN` (records ~291–293) after the private-R2 cutover attempt and again after Production `R2_PRIVATE_BUCKET` was cleared to empty (`dpl_MtAhpqWGxMtwbBxzy1EBBD1VunH7`).

## Checks
| Check | Result |
| --- | --- |
| Production `RUNNINGHUB_API_KEY` vs `.env.local` | Same fingerprint (`918d30148557ce68…`) |
| Production `R2_PRIVATE_BUCKET` | Empty string (rollback comment 2026-10-30 10:08 CST) |
| Prior canary provider tasks still queryable | `2115852669305446401` / `2115836280616214530` → `SUCCESS` |
| `POST /uc/openapi/accountStatus` | `remainCoins: "0"`, `remainMoney: "71.5220"`, `currency: CNY`, `apiType: NORMAL` |
| `POST /task/openapi/create` (same key + workflow) | HTTP 200 body `code:605` `msg:NOT_ENOUGH_BALANCE` `data:null` |

## Root cause
RunningHub RH coins are exhausted (`remainCoins=0`). Wallet CNY remains but create is refused with `NOT_ENOUGH_BALANCE`. SDK `createTaskGeneric` mapped any non-capacity non-zero code to `TASK_CREATION_OUTCOME_UNKNOWN`, which incorrectly told clients not to retry and to contact support.

## Fix shipped
- Treat `NOT_ENOUGH_BALANCE` / `TASK_CREATE_FAILED_BY_NOT_ENOUGH_WALLET` / `CORPAPIKEY_INSUFFICIENT_FUNDS` (with no taskId) as `TASK_CREATION_REJECTED` (`taskWasNotCreated=true`).
- `/api/generate` returns that code with a balance hint and marks the reservation failed.

## Unblock generate
Top up **RH coins** on the RunningHub account tied to Production `RUNNINGHUB_API_KEY` (console: https://www.runninghub.cn — wallet money alone did not clear `NOT_ENOUGH_BALANCE` in this probe). Then re-run a free or paid remove-background canary on Production **before** re-enabling `R2_PRIVATE_BUCKET`.

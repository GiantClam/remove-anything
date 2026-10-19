# Remove Anything P0 operating owners

This ownership map is the release companion for the P0 growth funnel change. It assigns roles rather than individual names so the project can use the current team roster without changing the product contract.

| Review area | Accountable role | Backup role | Cadence | Required output |
| --- | --- | --- | --- | --- |
| Search, page, locale, and auth funnel | Product/Growth owner | Analytics owner | Weekly, Monday | GA4/GSC export covering impressions, visits, `tool_view`, completion, download, signup, first purchase, and 30-day repeat |
| Processing reliability | Engineering owner | On-call engineer | Weekly, Tuesday | Failure rate, p50/p95 latency, retry rate, expired tasks, missing events, and incident actions |
| Per-tool cost and paid enablement | Product owner plus Finance/Cost approver | Engineering owner | Before each pricing or credit-cost change; monthly review | Tool-level model/provider cost, retry cost, `creditCost`, margin decision, and approval date |
| Measurement quality | Analytics owner | Engineering owner | Weekly, before funnel review | GA4 event receipt, deduplication checks, GSC freshness, and unresolved data-quality issues |

The Product/Growth owner schedules the review and records decisions in the weekly report. The Engineering owner blocks a release when task ownership, expiry, payment reconciliation, or event delivery is not verifiable. The Finance/Cost approver blocks paid output for any registry entry whose `creditCost` or provider-cost evidence is unknown.

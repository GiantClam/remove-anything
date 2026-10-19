# P0 Growth Funnel Foundation

## Problem

Remove Anything has usable background, object, watermark, and image-tool capabilities, but the current product cannot yet provide a trustworthy SEO-to-revenue measurement loop. The `/remove-objects` indexability strategy is inconsistent across page metadata, sitemap, and verification; free quota copy and server behavior disagree; the six core tools do not share a task, retry, result, or event contract; and the project has no verified target GA4 property or Search Console baseline.

The existing research establishes a planning hypothesis, not validated traffic or revenue. This change creates the smallest implementation-ready foundation for a 90-day measurement and funnel validation period.

## Users affected

- English-speaking visitors arriving on the six core tool pages.
- Anonymous users who need to complete one image task before deciding whether to register.
- Authenticated users consuming monthly free tasks or paid credits.
- Product, growth, and engineering owners who need page-level funnel and cost evidence.
- Account owners who must configure GA4, Search Console, and production environment values.

## In scope

- Make `/remove-objects` indexable and align metadata, sitemap, navigation, and SEO verification.
- Add a single tool registry for canonical paths, indexability, limits, locales, output contracts, and credit cost.
- Establish the target GA4 property and GSC verification as production release gates.
- Implement the shared event schema and server-authoritative processing, credit, and purchase events.
- Implement anonymous and authenticated quota behavior: one anonymous task per 24 hours and five authenticated tasks per UTC calendar month.
- Normalize task states, idempotent retry behavior, secure result access, and expiry handling.
- Bring the six existing canonical pages onto the shared upload → process → result flow with truthful output and limit disclosures.
- Add high-risk authorization confirmation and audit metadata for watermark, logo, people, and text removal.
- Add the required tests, production smoke checks, and the 28-day evidence gate for P1 expansion.

## Out of scope

- API documentation, API pricing, rate limits, or developer sales flow.
- New SEO page expansion, comparison clusters, or non-English localization.
- New model development or unverified format, resolution, and batch-capability expansion.
- Full unit-economics repricing; per-tool cost evidence and approval are required before paid enablement, while the detailed margin model remains P1.

## System changes

1. Introduce a registry-backed source of truth for SEO and tool configuration.
2. Add a server-side anonymous principal and quota ledger that can safely create, query, and download tasks.
3. Expose a common task state and error contract across model adapters.
4. Add idempotency keys for task, event, and payment processing.
5. Separate client behavioral analytics from server-confirmed processing, credit, and purchase facts.
6. Apply 24-hour file retention, 90-day minimal audit retention, and secure result authorization.

## Success verification

The change is ready for the 28-day baseline only after:

- GA4 DebugView receives the event schema in production and GSC verifies the domain.
- The six pages complete browser smoke flows from upload through result, failure/retry, and download or upgrade.
- `/remove-objects` is consistently `index, follow` in page metadata, sitemap, navigation, and tests.
- Quota, retries, credits, and payment webhook records reconcile without double counting.
- At least three core pages receive real GSC impressions during the 28-day window, processing and download rates have a stable baseline, and at least one attributable registration, purchase, or sales lead exists before P1 page expansion.

## References

- `requirements.md` (reviewable snapshot of the approved P0 requirements)
- `owners.md` (operating roles and release responsibilities)
- `implementation-evidence.md` (current implementation, validation, and open gates)
- `/Users/beihuang/Documents/ChatGPT/marketing/research/remove-anything-2026-10-13/strategy.md`
- `/Users/beihuang/Documents/ChatGPT/marketing/research/remove-anything-2026-10-13/evidence.md`
- `/Users/beihuang/Documents/ChatGPT/marketing/research/remove-anything-2026-10-13/backlog.md`

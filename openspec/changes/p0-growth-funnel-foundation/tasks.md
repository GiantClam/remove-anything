# Implementation Tasks

Status reviewed on 2026-10-15. This change is in progress and must not be archived or used to start the 28-day baseline. See `implementation-evidence.md` for verification scope and remaining release gates.

## Account and release prerequisites

- [x] Confirm the target GA4 property and create the Remove Anything web stream.
- [x] Create/verify the GSC domain.
- [x] Configure production `NEXT_PUBLIC_GA_ID` and verify the deployed GA4 script and a collection request.
- [ ] Capture production GA4 DebugView/realtime ingestion of the required event chain.
- [x] Define operating roles for weekly funnel review, reliability review, and per-tool cost approval in `owners.md`.

Earlier account evidence records GA4 account `29849090`, property `559043519`, stream `16131661294`, Measurement ID `G-VD6F0YDBQ5`, and GSC `sc-domain:remove-anything.com`. A deployed page previously delivered `page_view` with HTTP 204. These historical observations do not prove current event ingestion or the implementation in this working tree.

## Registry and SEO

- [x] Create the registry with canonical identity, locales, tool type, formats, limits, credit baseline, CTA, last-modified date, expiry, and related links.
- [x] Derive metadata, canonical, sitemap, related links, and locale availability from the registry.
- [x] Add `/remove-objects` to sitemap/navigation and remove conflicting `noindex` expectations.
- [x] Add registry and SEO regression checks.
- [x] Require an explicit recorded cost approval before a registry entry can enable paid output; configured credit baselines alone do not enable it.
- [ ] Approve actual provider/retry/storage costs and reconcile each tool's file, pixel, output, timeout, and pricing limits before enabling paid output.

## Quota and task lifecycle

- [x] Bind anonymous tasks/downloads to a signed principal and apply request rate limits.
- [x] Enforce one anonymous image task per 24 hours and five authenticated image tasks per UTC month across the persisted background, object, and watermark task tables.
- [x] Reserve quota before storage/provider side effects using serializable transactions and bounded conflict retries.
- [x] Reuse in-flight/successful idempotency keys; release failed setup allowance; preserve uncertain provider creation reservations instead of replaying a possibly paid request.
- [x] Keep expired completed tasks in monthly quota counts and preserve failed/canceled allowance after retention cleanup.
- [x] Map status APIs to the five shared states and protect terminal output/state from stale polling and callbacks; background/image watchers are serialized per provider task and require private output persistence plus state/output/expiry CAS before success.
- [x] Restrict automatic creation retries to one explicit provider capacity rejection; do not replay unknown transport/HTTP/JSON outcomes.
- [x] Authenticate RunningHub callbacks before body/database/output work, limit callback bodies and approved provider output reads, and use guarded private-output persistence.
- [x] Return a proven failed task's matching consumed credit at most once using a transactional ledger guard.
- [x] Verify subject, state, expiry, private headers, allowed output types, and bounded reads on the core background/object/watermark download paths.
- [x] Decode image inputs and verify MIME, 10MB bytes, 40MP safety limits, trusted HTTPS source origins, and matching PNG-mask dimensions in the main image creation/upload routes.
- [x] Return authorized preview addresses from background status GET/SSE and keep preview requests out of download counts; sign private R2 downloads on the server.
- [ ] Enforce anonymous low-resolution output on the server and implement approved paid/full-output entitlements.
- [ ] Enforce declared processing timeout, queue/concurrency limits, retry behavior, and input safety consistently in remaining detection/segmentation/composition flows.
- [ ] Close background composition authorization and historical public storage/URL bypasses; verify actual provider source approvals and private bucket policy.

## Measurement and attribution

- [x] Add shared event builders, common field support, stable task/order/ledger identifiers, and deduplication tests.
- [x] Add `tool_view` trackers to the six canonical pages.
- [x] Add selected server lifecycle/payment fact hooks and idempotent Stripe fulfillment with route-level tests.
- [x] Provide the review template (`weekly-funnel-review.md`) and an export helper that reports unavailable input as `NO DATA`.
- [ ] Wire and verify the complete required behavioral event chain across all six tools, signup, paywall, and checkout.
- [ ] Deliver server facts durably to the chosen analytics destination and verify receipt/recovery; the current default sink is structured logs.
- [ ] Implement and validate weekly page/tool/locale/auth funnels plus GSC, latency, retry, cost, repeat-purchase, and missing-event metrics. The offline helper now supports explicit grouping, supported reliability/cost/GSC slices, deduplication, and `NO DATA`, but production exports and receipt remain unverified.

## Core tool experience and retention

- [x] Add shared visible contracts, H1, FAQ, canonical, Schema, and related links to the six core pages; fix duplicate locale links and stale free-quota/share-reward claims.
- [x] Record authorization confirmation, policy version, subject, task ID, and audit deadline for high-risk object/watermark tasks; expose reporting/deletion contact paths.
- [x] Align the free watermark UI, registry, and create route to one image and a ZIP download; stop materializing untracked public preview files on status reads.
- [x] Add an authenticated bounded retention worker, default dry run, explicit execute flag, exact R2 key matching, retries, shared/provider blockers, cleanup markers, and a rollout runbook.
- [ ] Complete the shared upload/preview/process/result/failure/retry/download-or-upgrade flow and low/full-output distinction on all six tools.
- [ ] Enforce actual 24-hour source/result deletion including provider copies, overdue active jobs, shared assets, and historical assets missing a manifest.
- [ ] Apply 90-day minimal audit retention across every task model and verify the earlier-deletion request workflow operationally.

The worker is implemented in dry-run mode. As of 2026-10-15, execution is deliberately blocked with `RETENTION_EXECUTION_BLOCKED` because an offline race probe reproduced deletion after a new shared reference and a concurrent task-state/expiry change. Access expiry is not proof of physical deletion. Follow `retention-runbook.md` and `migration-runbook.md`; schema migration, coordinated cleanup claims, and execution rollout remain pending.

## Verification and rollout

- [x] Add unit and in-process route tests for registry/cost gates, quota, reservations, states, refunds, analytics IDs, callbacks, secure downloads, retention, and Stripe fulfillment.
- [x] Render all six canonical pages in English and the existing `zh-tw` locale in a browser and inspect H1, contracts, metadata, Schema, related links, and locale URLs.
- [x] Complete a mocked watermark queued/success/ZIP-download/expired-error browser flow, with the mock and development-auth boundaries recorded.
- [ ] Finish mocked browser processing/error/download flows and real provider flows for all six pages; rendered-page checks alone do not satisfy task-flow acceptance.
- [ ] Validate migrations, real database concurrency, callback/provider/storage behavior, purchase reconciliation, and audit records in an integration environment.
- [ ] Run deployed GA4, GSC, sitemap, canonical, indexability, purchase, retention, and audit checks after rollout.
- [ ] Start the 28-day baseline only after every release gate passes.
- [ ] Expand to P1 pages only after the three-page impressions, stable funnel, and attributable signal gates pass.

Local command results and browser evidence are recorded in `implementation-evidence.md`. The final local suite is 203/203, local SEO/HTTP smoke passes with GA loader scheduling, and browser hydration confirms the configured GA ID only with external requests blocked. A passing local suite does not close external-service, output entitlement, physical retention, or production measurement gates.

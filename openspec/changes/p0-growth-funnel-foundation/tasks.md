# Implementation Tasks

Status reviewed on 2026-10-30 (Asia/Shanghai early). OpenSpec still reports **40/56** tasks fully complete (no additional checkbox closed this turn). Same-day / overnight progress that does **not** yet flip additional checkboxes: Production Stripe live webhook secret configured, Preview `sk_test_` + credit-purchase canary PASS, remove-background `paidEnabled` with full-output still gated, sequential free canaries after persist+pooler now also cover transparent-png / white-background / change-background-color / Sora2 (**PASS**; batch remains paid-gated). Logged-in durable composition white/color Preview E2E **PASS** after private-R2 source read fix (PR #19). This change must not be archived or used to start the 28-day baseline. See `implementation-evidence.md` and `evidence/*-20261029.md` / `evidence/production-bg-variants-sora2-postpersist-canary-20261030.md`.

## Account and release prerequisites

- [x] Confirm the target GA4 property and create the Remove Anything web stream.
- [x] Create/verify the GSC domain. DNS TXT remains published; authenticated property receipt attached from account-holder Gmail (`sc-noreply@google.com` impressions-started + September digest). See `evidence/gsc-authenticated-property-20261029.md` (DNS baseline: `evidence/gsc-domain-dns-20261021.md`).
- [x] Configure production `NEXT_PUBLIC_GA_ID` and verify the deployed GA4 script and a collection request.
- [ ] Capture production GA4 DebugView/realtime ingestion of the required event chain.
- [x] Define operating roles for weekly funnel review, reliability review, and per-tool cost approval in `owners.md`.

Account evidence records GA4 account `29849090`, property `559043519`, stream `16131661294`, Measurement ID `G-VD6F0YDBQ5`, and GSC `sc-domain:remove-anything.com`. On 2026-10-21, production Realtime showed `page_view` and `session_start` after one browser visit; the complete task-to-checkout chain and DebugView evidence remain open. See `evidence/production-ga4-realtime-20261021.md`.

## Registry and SEO

- [x] Create the registry with canonical identity, locales, tool type, formats, limits, credit baseline, CTA, last-modified date, expiry, and related links.
- [x] Derive metadata, canonical, sitemap, related links, and locale availability from the registry.
- [x] Add `/remove-objects` to sitemap/navigation and remove conflicting `noindex` expectations.
- [x] Add registry and SEO regression checks.
- [x] Require an explicit recorded cost approval before a registry entry can enable paid output; configured credit baselines alone do not enable it.
- [ ] Approve actual provider/retry/storage costs and reconcile each tool's file, pixel, output, timeout, and pricing limits before enabling paid output. **Partial:** `remove-background` only — owner waived measured USD and enabled `paidEnabled: true` (`evidence/cost-approval-20261029.md`); other tools remain unapproved / `paidEnabled: false`.

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
- [x] Require an authenticated owner for composition creation/update and constrain the final update to that owner; require database-backed administrator permission for background-library creation and nonpublic listing, with denial before side effects.
- [x] Enforce anonymous low-resolution output on the server and keep paid/full-output entitlements disabled until an authenticated owner and recorded cost approval exist. The three core download boundaries now reject `output=full` before signing, storage reads, counters, or analytics. `remove-background` now has cost approval + `paidEnabled: true`, but **`FULL_OUTPUT_IMPLEMENTATION_ENABLED` remains `false`** — Production probe 2026-10-29: authenticated `output=full` → HTTP 402 `FULL_OUTPUT_NOT_ENABLED` (`evidence/remove-background-paid-full-output-gate-20261029.md`).
- [ ] Enforce declared processing timeout, queue/concurrency limits, retry behavior, and input safety consistently in remaining detection/segmentation/composition flows. Detect/segment validate decoded images, use process-local leases, and now pass the declared request deadline into provider create/status/result calls; the video queue uses task-type-scoped CAS claims, bounded provider deadlines, one safe pre-provider retry, and stale-lease failure recovery without replay. Shared cross-instance capacity, cancellation/reconciliation of late provider submissions, composition execution limits, and real provider acceptance remain open.
- [ ] Close background composition authorization and historical public storage/URL bypasses; verify actual provider source approvals and private bucket policy. Composition creation/update now require authenticated ownership and validated owned sources; results are stored under scoped keys in a dedicated private bucket and served through short-lived owner/expiry-checked URLs. Legacy arbitrary fetch/signing routes now return 410. Historical public objects/URLs and the actual private-bucket policy still need external reconciliation.

## Measurement and attribution

- [x] Add shared event builders, common field support, stable task/order/ledger identifiers, and deduplication tests.
- [x] Add `tool_view` trackers to the six canonical pages.
- [x] Add selected server lifecycle/payment fact hooks and idempotent Stripe fulfillment with route-level tests.
- [x] Provide the review template (`weekly-funnel-review.md`) and an export helper that reports unavailable input as `NO DATA`.
- [ ] Wire and verify the complete required behavioral event chain across all six tools, signup, paywall, and checkout.
- [ ] Deliver server facts durably to the chosen analytics destination and verify receipt/recovery. A server-only `analytics_events` sink and production table are deployed with stable `event_id` uniqueness, RLS, and client ACL revocation; schema duplicate-ID probe passed. Runtime delivery for `processing_completed` / `processing_failed` / `result_downloaded` is now observed in production (20 rows; see `evidence/analytics-events-runtime-20261029.md`); P2002 idempotent redelivery is unit-tested. Full signup→checkout→purchase chain and automatic outage retry/recovery remain open.
- [ ] Implement and validate weekly page/tool/locale/auth funnels plus GSC, latency, retry, cost, repeat-purchase, and missing-event metrics. The offline helper now supports explicit grouping, supported reliability/cost/GSC slices, deduplication, and `NO DATA`, but production exports and receipt remain unverified.

## Core tool experience and retention

- [x] Add shared visible contracts, H1, FAQ, canonical, Schema, and related links to the six core pages; fix duplicate locale links and stale free-quota/share-reward claims.
- [x] Record authorization confirmation, policy version, subject, task ID, and audit deadline for high-risk object/watermark tasks; expose reporting/deletion contact paths.
- [x] Align the free watermark UI, registry, and create route to one image and a ZIP download; stop materializing untracked public preview files on status reads.
- [x] Add an authenticated bounded retention worker, default dry run, explicit execute flag, exact R2 key matching, retries, shared/provider blockers, cleanup markers, and a rollout runbook.
- [ ] Complete the shared upload/preview/process/result/failure/retry/download-or-upgrade flow and low/full-output distinction on all six tools. Low-resolution image/ZIP delivery and a fail-closed full-output gate are implemented on core download routes; both Sora2 status routes now normalize to the shared five-state contract and keep success-without-durable-output recoverable. Mocked browser evidence covers the four background variants and Remove Objects retry/download states. **Production free sequential canaries PASS after persist hotfix + transaction pooler:** watermark, background, object (2026-10-29: `evidence/production-persist-hotfix-20261029.md`, `evidence/production-pool-incident-20261029.md`, `evidence/production-bg-object-postpersist-canary-20261029.md`); transparent-png / white-background / change-background-color / Sora2 (2026-10-30: `evidence/production-bg-variants-sora2-postpersist-canary-20261030.md`; white/color share `/api/generate` cutout + client compose; durable composition remains auth-only). Batch free path N/A (`paidEnabled:false`; anon POST 401). Paid/full delivery remains disabled (`FULL_OUTPUT_IMPLEMENTATION_ENABLED=false`). Authenticated durable composition E2E **PASS on Preview 2026-10-30 rerun** after private-R2 owner-scoped read (`evidence/preview-logged-in-composition-white-color-20261030.md` FAIL baseline; `evidence/preview-logged-in-composition-white-color-rerun-20261030.md` PASS: white/color R2 + relative download create, PUT, history; anon 401). Paid batch still open.
- [ ] Enforce actual 24-hour source/result deletion including provider copies, overdue active jobs, shared assets, and historical assets missing a manifest.
- [ ] Verify 90-day minimal audit retention and the earlier-deletion request workflow operationally. All four task models have 90-day audit fields and worker support, covered by local unit tests; production audit deletion, request delivery, and fulfillment remain unverified.

The worker is implemented in dry-run mode. As of 2026-10-21, execution remains deliberately blocked with `RETENTION_EXECUTION_BLOCKED` because an offline race probe reproduced deletion after a new shared reference and a concurrent task-state/expiry change. Access expiry is not proof of physical deletion. Follow `retention-runbook.md` and `migration-runbook.md`; coordinated cleanup claims, provider purge, and execution rollout remain pending.

## Verification and rollout

- [x] Verify the exact Vercel production/rollback SHA and detect Preview's shared production database/storage configuration through read-only checks.
- [x] Implement and test a read-only environment/schema preflight with column/index definitions and independently reviewed migration-receipt checks; a passing result does not close the full-spec release gates.
- [x] Trace the unapplied historical `flux_*` mapping change and record the scoped baseline compatibility plan preserving existing task IDs and billing references.
- [x] Rehearse scoped baseline repair and P0 patches on the isolated PostgreSQL 17 branch; verify mapped columns, sequence/table identity, indexes, repeated patches, and new-table RLS/ACL.
- [x] Verify synthetic historical task IDs, billing links, download/view relationships, scalar types and ownership predicates in a staging-only SQL transaction; independently confirm rollback cleanup and unchanged sequence state.
- [x] Rehearse the remaining queue/image/composition schema on isolated staging, verify 45 mapped columns, indexes/FKs/RLS/ACL, and roll back explicit-ID synthetic fixtures without sequence changes.
- [ ] Verify exact Prisma/application binary compatibility and rollback, accept the applied `0007_production_baseline_reconciliation.sql` and additive analytics migration through real application paths, and isolate Preview resources. On 2026-10-21, read-only random-ID task lookups returned expected 404s through deployed Prisma paths; mutation, transaction/concurrency, rollback, and Preview isolation acceptance remain open. See `evidence/production-application-probes-20261021.md`.
- [x] Add unit and in-process route tests for registry/cost gates, quota, reservations, states, refunds, analytics IDs, callbacks, secure downloads, retention, and Stripe fulfillment.
- [x] Render all six canonical pages in English and the existing `zh-tw` locale in a browser and inspect H1, contracts, metadata, Schema, related links, and locale URLs.
- [x] Complete a mocked watermark queued/success/ZIP-download/expired-error browser flow, with the mock and development-auth boundaries recorded.
- [ ] Finish mocked browser processing/error/download flows and low/full-output distinction for all six pages. Real provider/storage/download acceptance is now verified for object removal, background removal, transparent PNG, white background, background color, image watermark, and Sora2 in staging. Direct browser DOM evidence for the protected Preview remains limited by Vercel Deployment Protection; paid/full-output delivery remains disabled.
- [ ] Validate migrations, real database concurrency, callback/provider/storage behavior, purchase reconciliation, and audit records in an integration environment. **Partial purchase:** Preview test-mode credit purchase canary PASS (`evidence/stripe-preview-credit-purchase-canary-20261029.md`); Production live webhook secret configured (`evidence/stripe-production-webhook-20261029.md`); **no** Production live Checkout canary yet.
- [ ] Run deployed GA4, GSC, sitemap, canonical, indexability, purchase, retention, and audit checks after rollout. Sitemap/canonical/indexability smoke closed 2026-10-21; GSC **authenticated property** receipt closed 2026-10-29. Still open: full GA4 behavioral chain / DebugView, GSC impressions baseline, Production live purchase, physical retention execute, audit deletion.
- [ ] Start the 28-day baseline only after every release gate passes.
- [ ] Expand to P1 pages only after the three-page impressions, stable funnel, and attributable signal gates pass.

Local command results and browser evidence are recorded in `implementation-evidence.md`. The 2026-10-15 local SEO/HTTP smoke passed with GA loader scheduling; subsequent production deployment and read-only SEO checks are recorded there and in `evidence/production-deployment-20261020.md`. See `staging-migration-evidence.md` for the schema rehearsal, `staging-compatibility-evidence.md` for SQL-only historical fixtures, and `environment-setup.md` for remaining environment setup. A passing local suite does not close external-service, output entitlement, physical retention, or production measurement gates.

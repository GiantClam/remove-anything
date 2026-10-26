## Context

See `proposal.md` for motivation and the four delta specs for user-visible requirements. The application is a Next.js service backed by Prisma/PostgreSQL, Cloudflare R2, external image/video providers, GA4, and Stripe. Existing tool pages and provider adapters are already deployed, so the design keeps those boundaries and adds shared contracts around them. The rollout must preserve legacy task and billing references. Preview currently shares production resources and is limited to read-only checks until isolated resources exist.

## Goals / Non-Goals

**Goals:**

- Make the tool registry, quota rules, lifecycle states, output contract, and analytics vocabulary consistent across the existing canonical tools.
- Make task creation, result delivery, payment fulfillment, and event recording safe under retries and concurrent requests.
- Keep the implementation deployable in stages with evidence that distinguishes local fixtures, isolated staging, and production behavior.

**Non-Goals:**

- Enable paid or full-resolution output before per-tool cost approval and implementation.
- Expand the set of canonical tools, add new provider capabilities, or start the measurement baseline before its release gates pass.
- Treat a schema rehearsal, local mock, or read-only production probe as provider, storage, billing, or deletion acceptance.

## Decisions

1. **Use a registry as the source of tool-facing configuration.** Canonical paths, locales, limits, file types, output formats, expiry, related links, and baseline credits are declared once and consumed by metadata, page contracts, sitemap generation, and server-side cost gates. Per-tool pages remain responsible for their actual UI and provider-specific inputs. Duplicating those values in pages and route handlers was rejected because it lets visible claims drift from server enforcement.

2. **Keep one server-authoritative task lifecycle and quota boundary.** Routes validate input and reserve quota/idempotency before storage or provider effects; model adapters map provider states into the shared lifecycle; status and download handlers verify the owner or signed anonymous principal, state, and expiry. Known pre-provider failures may use a bounded retry. Ambiguous provider outcomes remain reserved for reconciliation instead of being resubmitted. A queue claim and terminal update use compare-and-set predicates so overlapping workers cannot both own a row.

3. **Persist sensitive results privately and release them through authorized server paths.** Storage keys stay server-side. Download handlers verify ownership, successful state, expiry, content type, and byte limits before issuing a short-lived signed read or streaming a bounded response. Public URLs are not treated as authorization. Paid/full output stays closed until approval and a separately validated delivery path exist.

4. **Separate client behavior from server-confirmed facts.** Shared event builders define names, fields, and stable IDs. Client events describe page and user actions; server routes, workers, and payment webhooks emit confirmed lifecycle and purchase facts to a server-only durable sink. Unavailable report inputs produce `NO DATA`, not a fabricated zero. Direct client writes to the server event table were rejected to preserve event provenance and access control.

5. **Make retention a guarded, auditable operation.** The worker defaults to dry run, selects a bounded set of eligible records, and deletes only exact recorded keys after checking shared references, active task state, and provider cleanup status. Access expiry alone is not physical deletion. Because new references and task updates can race with cleanup, execution remains blocked until the storage and task writers coordinate through a shared cleanup claim or equivalent transactionally enforced guard.

6. **Use additive, rehearsed schema changes and preserve legacy identity.** SQL patches are reviewed, checksummed, rehearsed on isolated PostgreSQL staging, and verified against Prisma mappings, indexes, row counts, RLS, and client privileges. Historical task IDs and billing links are preserved. Production application-path writes, concurrency, and rollback require a separately approved integration window; a read-only probe is not a substitute.

## Risks / Trade-offs

- **Provider timeouts can hide successful submissions** → Keep uncertain reservations active, never automatically replay them, and reconcile using provider task IDs or operational evidence.
- **A private bucket may be misconfigured or inaccessible** → Fail closed when the private bucket is missing or aliases the public bucket; verify bucket policy and scoped credentials before real storage acceptance.
- **Local concurrency limits do not coordinate multiple instances** → Use database-backed claims where supported, report process-local limits explicitly, and keep shared-capacity acceptance open until tested across instances.
- **Retention can race with new references or active work** → Keep execution disabled while the race is reproducible; require a coordinated claim, exact-key deletion, and post-delete verification.
- **Historical public object URLs may bypass current handlers** → Reconcile stored URLs and bucket/CDN policy before asserting privacy; endpoint hardening alone cannot revoke an already public object.
- **Analytics can be schema-valid but operationally absent** → Verify runtime insertion, deduplication, delivery recovery, and destination receipt before closing measurement gates.

## Migration Plan

1. Implement registry, route, lifecycle, analytics, and retention changes behind tests and explicit disabled-by-default paid/retention gates.
2. Rehearse schema patches and historical-reference compatibility on isolated PostgreSQL staging; confirm checksums, mapped columns, indexes, RLS/ACLs, row counts, and rollback cleanup.
3. Apply reviewed additive/reconciliation patches only to the intended production database with an independently checked receipt and rollback plan. Preserve legacy identifiers and billing relationships.
4. Deploy the matching application and verify read-only SEO and authentication boundaries first. Do not use shared-resource Preview for provider, queue, storage, payment, or mutation tests.
5. In an isolated integration environment, validate real Prisma writes/concurrency, provider callbacks, private R2 behavior, purchase reconciliation, retention deletion, and analytics receipt. Enable paid output, retention execution, or the 28-day baseline only after their corresponding evidence gates pass.
6. If rollback is required, restore the reviewed application binary and follow the migration runbook; do not drop renamed/preserved historical tables or reverse additive schema changes until task IDs and billing references are reconciled.

## Open Questions

- Who will provision and verify isolated Preview database and object-storage resources?
- Which approved provider output origins and paths will be used for callback result migration?
- What cleanup-claim mechanism will be adopted to coordinate retention with every reference creator and task/status writer?
- Which owner will record per-tool provider, retry, and storage cost approvals, and where will the supporting evidence live?

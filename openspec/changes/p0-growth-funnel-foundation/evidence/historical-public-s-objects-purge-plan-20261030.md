# PLAN ONLY — historical public `s.remove-anything.com` objects — 2026-10-30

Authority: t48u continue residuals after 28-day baseline start. **No deletion was performed.** Do not delete any historical public R2 objects until this plan is approved and executed under a separate change.

## Context

- Production now writes new uploads/results to private bucket `remove-anything-private` (`R2_PRIVATE_BUCKET` set; cutover PASS in `production-private-r2-cutover-pass-20261030.md`).
- DB locators still use host `https://s.remove-anything.com/...` as a **key-shape** prefix; `getR2ObjectKey` derives object keys from that host.
- Objects created **before** private cutover may still exist in the public bucket behind custom domain `s.remove-anything.com` and remain anonymously readable until reconciled.
- New keys after cutover should 404 on the public CDN (object only in private bucket).

## Goals

1. Inventory historical public objects without mutating them.
2. Classify each key as: still referenced by DB / composition / media tables; orphan; or shared.
3. Only then propose a bounded purge of **orphans** (and CDN cache invalidation), never blind bucket wipes.

## Non-goals

- No deletion in this document or accompanying PR.
- No change to `R2_PRIVATE_BUCKET`.
- No provider (`rh-images.*`) CDN DELETE (see provider-purge evidence; no RH delete API).
- No global “list and delete everything older than N days” without reference checks.

## Proposed phases (execute later)

### Phase 0 — Freeze & owners

- Owner: Engineering. Approver: Product + privacy contact.
- Confirm public bucket name, custom domain `s.`, and that private bucket has no public custom domain / `r2.dev` disabled.
- Announce maintenance window only if CDN invalidation or domain cutover is required.

### Phase 1 — Read-only inventory

1. Export object keys from the **public** bucket (prefix-scoped lists: `uploads/`, `watermark-removal/`, `background-removal/`, `object-removal/`, composition prefixes, `examples/` keep-list).
2. Export referenced keys from production DB (SELECT-only):
   - `background_removal_task` source/result URL columns
   - `object_removal_task` / `watermark_removal_task` / `task_data` URL columns
   - background compositions, background images, media, user images
3. Normalize URLs → keys via the same `getR2ObjectKey` rules (host `s.remove-anything.com`).
4. Produce three sets: `referenced`, `orphan_candidate`, `keep_static` (`examples/`, marketing assets).

Deliverable: CSV/JSON inventory checked into evidence (no secret credentials; keys only).

### Phase 2 — Safety gates before any delete

- Orphan candidates must have **zero** matches across all reference tables above.
- Skip any key still inside a task’s 24h access window or lacking `retentionCleanedAt` when the row exists.
- Shared-reference logic must match retention worker (fail closed).
- Dry-run delete API against a **staging** copy of the public bucket first (or a mirrored prefix), never production.

### Phase 3 — Bounded purge (future PR only)

- Batch size ≤ 100 keys; exact-key DELETE only; no prefix delete.
- Log each deleted key + reason `orphan_unreferenced`.
- After each batch, re-query references for a sample of deleted keys (expect zero).
- Optional: Cloudflare cache purge for those URLs only.

### Phase 4 — Domain / policy convergence (optional later)

- Keep `s.` as locator host for private signed reads **or** migrate locators to a non-public host in a separate migration.
- Confirm public bucket policy denies anonymous GetObject for application prefixes once orphans are gone (static `examples/` may remain public by design).

## Rollback

- Deletion is irreversible for object bytes. Keep inventory + batch logs. Do not start Phase 3 without backup or accepted loss sign-off.

## Status

| Item | Status |
| --- | --- |
| Plan written | **DONE** (this file) |
| Inventory export | **DONE** — full key listing + DB join classify in `historical-public-s-objects-classify-pass-20261030.md` (t49u) |
| Orphan candidate report | **DONE** — 813 keys / ~2.22 GB; see classify-pass + `*-orphan-candidates-20261030.json` |
| User approval for Phase 3 delete | **DONE** — t49u widget「批准删除（含 sora2）」 |
| Any historical public delete | **DONE** — 813 orphans deleted; see `historical-public-s-objects-purge-pass-20261030.md` |

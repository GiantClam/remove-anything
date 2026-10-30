# Historical public `s.` orphan classification — PASS (read-only) — 2026-10-30

Authority: **t49u** residual #1. **READ-ONLY. Zero deletes. `R2_PRIVATE_BUCKET` untouched.**

Timezone labels: Asia/Shanghai (UTC+8).

## Method

1. `ListObjectsV2` on public bucket `remove-anything` (host `s.remove-anything.com`).
2. SELECT-only Prisma reads of URL columns:
   - `task_data` (`input_image_url`, `image_url`, `r2_url`, `replicate_urls`)
   - `background_removal_tasks` (`input_image_url`, `output_image_url`)
   - `watermark_removal_tasks` (`input_zip_url`, `output_zip_url`)
   - `object_removal_tasks` (`input_image_url`, `input_mask_url`, `output_image_url`)
   - `background_compositions` (`foreground_image_url`, `result_image_url`)
   - `background_images` (`image_url`, `thumbnail_url`)
   - `media` (`url`, `key`)
   - `user` (`image`)
3. Normalize URLs → keys with the same rules as `lib/r2-object-key.ts` `getR2ObjectKey` against `R2_URL_BASE`.
4. Classify each public key:
   - **keep_static** — prefix `examples/` or `sample/`
   - **referenced** — key appears in any DB locator above
   - **orphan_candidate** — neither of the above

Artifacts (keys + sizes only; no credentials):

| File | Role |
| --- | --- |
| `historical-public-s-objects-classify-summary-20261030.json` | Rollups + samples |
| `historical-public-s-objects-full-listing-20261030.json` | All 937 keys |
| `historical-public-s-objects-orphan-candidates-20261030.json` | Purge candidate key list |
| `historical-public-s-objects-referenced-20261030.json` | Must-keep (DB-referenced) |
| `historical-public-s-objects-keep-static-20261030.json` | Marketing/examples keep |
| `historical-public-s-objects-db-keys-missing-public-20261030.json` | DB `s.` keys absent from public (private-cutover expected) |

## Results

| Class | Count | Bytes |
| --- | --- | --- |
| Public objects listed | **937** | **2,298,691,434** (~2.30 GB) |
| keep_static (`examples/` + `sample/`) | **34** | 9,438,602 (~9.4 MB) |
| referenced (DB hit) | **90** | 65,796,139 (~65.8 MB) |
| **orphan_candidate** | **813** | **2,223,456,693** (~2.22 GB) |

### Orphan candidates by prefix

| Prefix | Count | Bytes |
| --- | --- | --- |
| `uploads/` | 355 | ~1.57 GB |
| `background-removal/` | 424 | ~544 MB |
| `sora2-videos/` | 8 | ~63.3 MB |
| `watermark-removal/` | 26 | ~43.6 MB |

### Referenced (must keep for now)

| Prefix | Count | Bytes |
| --- | --- | --- |
| `background-removal/` | 71 | ~44.3 MB |
| `uploads/` | 14 | ~18.9 MB |
| `watermark-removal/` | 3 | ~0.7 MB |
| `object-removal/` | 1 | ~0.3 MB |
| `sora2-video-watermark-removal/` | 1 | ~1.6 MB |

Of the 90 referenced keys: **36** still have `expiresAt` in the future; **all 90** sit on rows without `retentionCleanedAt` (expected — cleaned rows scrub URLs and therefore leave the referenced set).

### DB locators not on public bucket

**67** distinct `s.remove-anything.com` keys appear in DB but are **absent** from the public bucket — consistent with private-bucket cutover for new writes. Do not treat these as delete targets on the public bucket.

## Safety gates (Phase 2) — status

| Gate | Status |
| --- | --- |
| Orphan has zero matches across reference tables | **Met** for the 813 list (by construction) |
| Skip keys inside active access window when row exists | N/A for orphans (no row); referenced list includes 36 with future `expiresAt` → **keep** |
| Shared-reference fail-closed (retention worker parity) | Classification used the same tables as `defaultSharedReferenceCheck` extras + task models |
| Dry-run on staging copy before production delete | **Not started** |
| Any historical public delete | **NOT DONE** |

## Hold-outs recommended before first purge batch

1. **`sora2-videos/` (8 objects, ~63 MB)** — classified orphan (no DB row) but may be marketing/demo assets. **Exclude from first delete batch** until Product confirms disposable.
2. **All 90 referenced keys** — never delete while locators exist.
3. **All `examples/` + `sample/` (34)** — keep by design.
4. **Private bucket `remove-anything-private`** — out of scope; do not list-delete there as part of this residual.

## Proposed first purge batch (FUTURE PR ONLY — needs explicit user approval)

- Scope: orphan_candidate **minus** `sora2-videos/**`
- Size: **805** keys / ~**2.16 GB**
- Method: exact-key `DeleteObject` only; batch ≤ 100; log each key + reason `orphan_unreferenced`
- After each batch: re-query DB for a sample of deleted keys (expect zero hits)
- Optional: Cloudflare cache purge for those URLs only
- **No prefix delete. No private-bucket changes. No RunningHub CDN delete.**

## Rollback notes

- Object-byte deletion is irreversible.
- Keep this inventory + per-batch delete logs before any Phase 3 PR.
- If a mistaken delete occurs, restore only from backup (none configured here) or accept loss.
- Referenced/keep lists in this evidence set are the recovery checklist for “what must still exist”.

## Approval checklist (user)

Copy and check when authorizing a **future** delete PR (not this PR):

- [ ] I reviewed orphan list `historical-public-s-objects-orphan-candidates-20261030.json`
- [ ] I confirm `examples/` and `sample/` stay
- [ ] I decide `sora2-videos/` : **KEEP for now** / **include in purge** (circle one)
- [ ] I accept irreversible loss of ~2.16 GB (or ~2.22 GB if sora2 included) of unreferenced public objects
- [ ] I authorize exact-key deletes only, batch ≤ 100, on public bucket `remove-anything` only
- [ ] I do **not** authorize changes to `R2_PRIVATE_BUCKET` / private objects
- [ ] Staging dry-run completed (or I waive it in writing)

## This PR

Evidence + plan status update only. **No delete code. No env changes. No object mutations.**

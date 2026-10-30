# Historical public `s.` orphan purge — PASS — 2026-10-30

Authority: **t49u widget** — 「批准删除（含 sora2）」. Asia/Shanghai (UTC+8).

## Scope executed

| Rule | Applied |
| --- | --- |
| Bucket | Public `remove-anything` only |
| Keys | Orphan candidates from classify PR #45 (**including** `sora2-videos/`) |
| Keep | `examples/`, `sample/`, all DB-referenced keys |
| Method | Exact-key `DeleteObject` only; batches ≤ 100; Head → Delete → Head verify |
| Private bucket / `R2_PRIVATE_BUCKET` | **Untouched** |
| Secrets | Not recorded |

## Sample dry-run (cheap)

Deleted 2 tiny objects first (`sora2-videos/*-test-video.mp4`, 18 B each).

| | Before | After |
| --- | --- | --- |
| Object count | 937 | 935 |
| Bytes | 2,298,691,434 | 2,298,691,398 |
| Deleted | **2** / 36 B | failures **0** |

## Full purge

| Metric | Value |
| --- | --- |
| Planned orphans | 813 |
| Already absent at full start (sample) | 2 |
| Targeted in full run | 811 |
| **Deleted (full)** | **811** |
| **Bytes deleted (full)** | **2,223,456,657** |
| **Deleted total (sample+full)** | **813** |
| **Bytes deleted total** | **2,223,456,693** (~2.22 GB) |
| Failed | **0** |
| Skipped (keep/ref/new-ref) | **0** |

## Before / after (public bucket)

| | Before (pre-sample) | After (independent recount) |
| --- | --- | --- |
| Objects | **937** | **124** |
| Bytes | **~2.30 GB** | **75,234,741** (~71.8 MiB) |

### Remaining prefixes (after)

| Prefix | Count | Bytes |
| --- | --- | --- |
| `background-removal` | 71 | 44,297,029 |
| `uploads` | 14 | 18,940,220 |
| `sample` | 13 | 5,500,550 |
| `examples` | 21 | 3,938,052 |
| `sora2-video-watermark-removal` | 1 | 1,621,363 |
| `watermark-removal` | 3 | 666,667 |
| `object-removal` | 1 | 270,860 |
| `sora2-videos` | **0** | 0 |

Remaining = keep_static (34) + previously referenced (90) = **124**. `sora2-videos/` fully removed.

## Artifacts

- `historical-public-s-objects-purge-sample-20261030.json`
- `historical-public-s-objects-purge-result-20261030.json`
- `historical-public-s-objects-purge-deleted-keys-20261030.json` (811 keys from full run; sample keys in sample JSON)
- `historical-public-s-objects-purge-after-recount-20261030.json`

## Non-goals / still out of scope

- No private-bucket deletes
- No RunningHub `rh-images.*` purge (no vendor API)
- No CDN cache purge batch (optional follow-up)
- Domain/policy convergence (Phase 4) not done

## Verdict

**PASS** — all 813 orphan candidates deleted from public bucket; failures 0; keep + referenced retained.

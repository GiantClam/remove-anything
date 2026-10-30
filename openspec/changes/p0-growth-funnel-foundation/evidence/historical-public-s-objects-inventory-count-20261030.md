# Historical public `s.` object inventory count — 2026-10-30 (Asia/Shanghai)

Authority: t48u count; t49u DB join. **READ-ONLY. No deletes.**

Source: S3 `ListObjectsV2` against production public bucket `remove-anything` using Production object credentials. Secrets not recorded.

| Metric | Value |
| --- | --- |
| Listed at (count) | 2026-10-30T12:19:56+08:00 (Asia/Shanghai) |
| Listed at (classify join) | see `historical-public-s-objects-classify-summary-20261030.json` |
| Object count | **937** |
| Bytes total | 2298691434 (~2.30 GB) |
| List pages | 1 |

## Top-level prefix counts

| Prefix | Count |
| --- | --- |
| `background-removal` | 495 |
| `uploads` | 369 |
| `watermark-removal` | 29 |
| `examples` | 21 |
| `sample` | 13 |
| `sora2-videos` | 8 |
| `object-removal` | 1 |
| `sora2-video-watermark-removal` | 1 |

## Classification (Phase 1 complete)

See `historical-public-s-objects-classify-pass-20261030.md` and companion JSON. **No purge executed.**

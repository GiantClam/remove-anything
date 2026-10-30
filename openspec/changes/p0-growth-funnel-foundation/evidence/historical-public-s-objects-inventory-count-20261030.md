# Historical public `s.` object inventory count — 2026-10-30 (Asia/Shanghai)

Authority: t48u. **READ-ONLY. No deletes.**

Source: S3 `ListObjectsV2` against production public bucket `remove-anything` using Production object credentials. Secrets not recorded.

| Metric | Value |
| --- | --- |
| Listed at | 2026-10-30T12:19:56+08:00 (Asia/Shanghai) |
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

## Next

Classify against DB references per `historical-public-s-objects-purge-plan-20261030.md` Phase 1 before any purge PR.

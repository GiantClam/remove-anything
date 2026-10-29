# Composition / historical public R2 bucket policy status — 2026-10-30 (Asia/Shanghai)

Authority: t39u. Cloudflare control-plane read via authenticated MCP (`user-Cloudflare`).

## Production bucket `remove-anything`

| Control-plane fact | Value |
| --- | --- |
| Managed `r2.dev` public URL | **disabled** (`enabled: false`; probe `pub-8c588…r2.dev` → HTTP **401**) |
| Custom domain | **`s.remove-anything.com` enabled** (SSL/ownership active) |
| Location | APAC / Standard |

### Object reachability via custom domain (historical public path)

Anonymous GETs returned **HTTP 200** for real objects (canary/sample keys), e.g.:

| URL (public CDN) | HTTP | Notes |
| --- | --- | --- |
| `/sample/2.png` | 200 | PNG 512² |
| `/uploads/C0Q0ZaWyYc6s.png` | 200 | canary upload from 2026-10-29 object flow |
| `/uploads/zyY-uwV5I8iy.png` | 200 | canary mask |
| `/uploads/6p1gWKp0V4uS.png` | 200 | large PNG |

**Conclusion:** disabling `r2.dev` alone does **not** close the historical public bypass. The custom domain still serves objects without app auth.

## Production private composition bucket

| Check | Result |
| --- | --- |
| Cloudflare bucket named for prod private composition | **Not present** among account buckets (only `remove-anything`, plus staging pair) |
| Vercel **Production** `R2_PRIVATE_BUCKET` | **Absent** from `vercel env ls production` / env pull name list |
| Vercel Preview `R2_PRIVATE_BUCKET` | Present on Preview branch `codex/p0-growth-funnel-foundation-preview` |

Staging pair (from earlier evidence + CF readback):

- `remove-anything-storage-staging` — `r2.dev` disabled, no custom domain
- `remove-anything-storage-staging-private` — `r2.dev` disabled, no custom domain

## App-path status (already shipped)

- Composition create/update require auth + owned sources; results intended for dedicated private bucket + short-lived owner URLs ([PR #19](https://github.com/GiantClam/remove-anything/pull/19) Preview E2E PASS).
- `requirePrivateCompositionBucket` fails closed when private bucket missing or aliases public bucket.
- Legacy arbitrary fetch/sign routes return 410.

## Gate status

OpenSpec item “Close background composition authorization and historical public storage/URL bypasses; verify … private bucket policy” remains **OPEN** for Production because:

1. Historical objects on `s.remove-anything.com` remain anonymously readable.
2. Production still lacks a separate private composition bucket + `R2_PRIVATE_BUCKET` env.
3. No orphan-key manifest / rewrite of historical public URLs was performed this turn.

**No production bucket policy was changed this turn** (read-only reconciliation).

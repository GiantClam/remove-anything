# GA4 inline-script `//` comment bug fix — 2026-10-30 (Asia/Shanghai)

Authority: t39u continue / user “全部需要验证”. Deploy: Production `dpl_DvVoid3v8oESNyFQeKy1TdyjkoWn` / commit `bee2997` ([PR #38](https://github.com/GiantClam/remove-anything/pull/38)).

## Root cause

`components/analytics.tsx` embedded a bootstrap string in a normal JS template literal with:

```js
if (!/\/g\/collect|\/collect\?/.test(url)) return url;
```

Template-literal evaluation turns `\/` into `/`, so the browser received:

```js
if (!//g/collect|/collect?/.test(url)) return url;
```

The `//` starts a line comment. The rest of the `#google-analytics` bootstrap never ran, so `window.gtag` stayed undefined and no `/g/collect` (and no `_dbg=1`) fired even with `?debug_mode=1`. This matches the earlier headless gap noted in `ga4-dbg-fix-20261030.md`.

## Fix

- Extract `lib/ga-inline-script.ts` → `buildGaInlineScript(gaId)`.
- Use `indexOf('/g/collect')` / `indexOf('/collect?')` instead of a slash-escaped regex literal (survives template embedding).
- Unit tests in `tests/growth/ga-inline-script.test.ts` assert the emitted script does not contain `!//g/collect` and that `_dbg=1` append logic works.

## Production verification (this run)

| Check | Result |
| --- | --- |
| Production deploy READY for merge of #38 | **PASS** — `dpl_DvVoid3v8oESNyFQeKy1TdyjkoWn` |
| Layout chunk `layout-20296b78332ea854.js?dpl=dpl_DvVoid…` contains `if (!//g/collect` | **ABSENT (PASS)** |
| Same chunk contains `indexOf('/g/collect')`, `withDbg`, `_dbg=1` | **PASS** |
| Unit probe of shipped `withDbg` on sample collect URLs | **PASS** (idempotent; non-collect unchanged) |
| `R2_PRIVATE_BUCKET` still present on Production env | **PASS** (key present; value not printed; not reversed) |
| Live browser network: `g/collect` hits with `_dbg=1` | **NOT CAPTURED here** — headless Chrome on Mac returned empty DOM; needs interactive / computerUse pass |
| GA4 Admin DebugView screenshot | **STILL NEEDED** — box GA session from earlier 2FA may still be logged in; parent computerUse can screenshot after visiting `?debug_mode=1` |

## Verdict

Syntax bug that blocked all gtag bootstrap (including `_dbg=1`) is fixed and deployed. Chunk-level proof is solid. **Admin DebugView UI receipt + live collect network capture still need a browser pass.** 28-day baseline not started.

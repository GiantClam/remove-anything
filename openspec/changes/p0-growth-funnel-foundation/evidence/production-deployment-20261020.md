# Production application deployment evidence

Deployed: 2026-10-20 (UTC). Vercel deployment: `dpl_EBUiAJaMuWsT6zGjKZKyqBn3Uhen`. Git SHA: `e9182e0ed02f4cbe26b5098dd904e32e3ae12b97` (merge of PR #3).

The evidence-only follow-up merge (PR #4) produced `dpl_CC8QgSWzxTKg2menFvtPFD5tYiGs`, which also reached `READY` without runtime code changes.

The deployment reached `READY` and GitHub reported the Vercel status as success. The production read-only checks then passed:

- `node scripts/verify-seo.mjs https://www.remove-anything.com`.
- `SMOKE_BASE_URL=https://www.remove-anything.com SMOKE_GA_ID=G-VD6F0YDBQ5 node scripts/smoke-canonical-pages.mjs`.
- `/remove-objects` returned HTTP 200 with canonical `https://www.remove-anything.com/remove-objects`, `index, follow`, and JSON-LD; `sitemap-tools.xml` contains `/remove-objects`.
- `/api/auth/session` returned `{}` without a session; `/api/account` and `/api/mine-tasks` returned 401; `/api/task-queue/status` returned an empty `0/4` queue.
- A browser load of `/remove-background` and `/remove-objects` found the GA4 loader and inline initialization, the expected H1 and JSON-LD, and no console errors.

This is deployment and read-only route evidence. It does not prove a real provider run, callback delivery, queue dispatch under load, paid entitlement, R2 mutation, physical/provider deletion, payment reconciliation, or GA4 DebugView/realtime receipt. The remaining OpenSpec release gates stay open.

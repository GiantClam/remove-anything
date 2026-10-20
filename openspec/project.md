# Project Context

## Purpose

Remove Anything is a Next.js 14 App Router application for browser-based image cleanup and export workflows. The P0 change covers six canonical marketing tools, their task APIs, quota and credit handling, SEO metadata, and production funnel measurement.

## Runtime boundaries

- Marketing pages live under `app/[locale]/(marketing)` and share React components from `components/`.
- Tool configuration, lifecycle contracts, analytics event builders, and sitemap generation live under `lib/`.
- Task persistence and migrations live under `db/` and `prisma/`.
- Background processing integrates with provider adapters and Cloudflare storage; authentication and credits use the existing account and Stripe flows.
- Production evidence includes GA4, Google Search Console, sitemap, browser smoke, payment, and audit checks.

## Verification commands

Use the repository's package manager (`pnpm`) for the normal gates:

```bash
pnpm test
pnpm lint
pnpm build
pnpm test:smoke
pnpm report:weekly
openspec validate p0-growth-funnel-foundation --strict --no-interactive
```

The smoke and production checks may require configured environment variables and a reachable deployment. A passing unit suite does not replace production or external-service evidence.

## Change conventions

- Keep canonical tool identity and SEO decisions in `lib/tool-registry.ts`.
- Keep task state, retry, expiry, ownership, and credit behavior server authoritative.
- Add schema changes as migrations under `db/migrations/` and update the relevant persistence code.
- Every OpenSpec requirement must use a delta section and include at least one `#### Scenario:` block.

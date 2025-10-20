# Repository Guidelines

## Project Structure & Module Organization
The Next.js app router organizes locale routes under `app/[locale]`; keep dashboards in `app/[locale]/(app)` and marketing pages in `(marketing)`. Route handlers in `app/api` should call domain logic from `modules/**` (auth, tasks, payments, Cloudflare storage). UI lives in `components/**`, shared helpers in `lib/`, and reusable types in `types/`. Prisma access stays in `db/` (client, queries, DTOs) with the schema at `prisma/schema.prisma`. Store static assets in `public/`, React emails in `emails/`, and automation scripts in `scripts/`.

## Build, Test, and Development Commands
- `npm run dev` — launch the Next.js dev server with locale middleware.
- `npm run build` — generate Prisma client and create the production bundle.
- `npm run build:cloudflare` + `npm run deploy` — prepare and ship the Worker build.
- `npm run lint` — enforce Next.js and Tailwind ESLint rules.
- `npm run db:migrate` / `npm run db:push` — manage Prisma migrations; run `npm run test:ai-gateway`, `node scripts/test-dashboard-api.js`, and `node scripts/test-download.js` to cover integrations.

## Coding Style & Naming Conventions
TypeScript is required for runtime code. Prettier (tab width 2, double quotes, trailing commas) plus `@ianvs/prettier-plugin-sort-imports` manages formatting and import order—run `npm run prettier` for bulk fixes. Keep React components in PascalCase files, colocate server actions with their route, and rely on the Tailwind plugin to keep utility classes ordered.

## Testing Guidelines
Testing is script-driven. Execute the commands above before opening a PR and note any manual verification (Cloudflare uploads, Stripe flows, locale rendering). Add new harnesses in `scripts/`, keep fixtures near their module, and rerun `npm run lint` after schema or API updates.

## Commit & Pull Request Guidelines
Prefix commit summaries with bracketed scopes such as `[bug]`, `[feature]`, or `[chore]`, and keep subjects verb-led. Each PR should include a change overview, proof of successful commands (`npm run lint`, relevant test scripts), a linked issue or ticket, and screenshots or recordings for UI shifts. Note new environment variables or migration steps so reviewers can reproduce and tag the relevant owners when Cloudflare scripts or domain modules change.

## Environment & Configuration
Install dependencies with `npm install` (pnpm is also supported). Copy `env.template` to `.env.local`, `env.cloudflare.template` for Worker deployments, and reuse `dev.env.example` when running local scripts; `node scripts/setup-local-dev.js` seeds defaults. After schema edits run `npm run db:generate` and `npm run db:migrate`, then confirm bindings with `npm run check-config` before shipping Cloudflare updates.

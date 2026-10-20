/**
 * The lifecycle helpers import the application Prisma singleton. Unit tests
 * install a deterministic fake on globalThis before importing that module;
 * this adapter keeps the production module untouched while still exercising
 * the real quota/expiry/credit logic.
 */
export const prisma =
  (globalThis as typeof globalThis & { __TEST_PRISMA__?: unknown }).__TEST_PRISMA__ ??
  ({} as any);

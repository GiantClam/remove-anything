import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/db/prisma";
import { createR2S3Service } from "@/lib/r2-s3";
import { RETENTION_EXECUTE_ENV, runTaskRetention } from "@/lib/task-retention";

export const dynamic = "force-dynamic";

function configuredBatchSize() {
  const value = Number(process.env.TASK_RETENTION_BATCH_SIZE || 100);
  return Number.isFinite(value) ? value : 100;
}

function hasValidCronSecret() {
  return (
    typeof process.env.CRON_SECRET === "string" &&
    process.env.CRON_SECRET.trim().length > 0
  );
}

function isAuthorized(req: NextRequest) {
  if (!hasValidCronSecret()) return false;
  return (
    req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
  );
}

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret()) {
    return NextResponse.json(
      { error: "cron secret is not configured" },
      { status: 503 },
    );
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Incident hotfix 2026-10-29: dry-run retention hammers session-mode pool
  // (EMAXCONNSESSION / pool_size:15). Keep the route callable for auth checks,
  // but skip Prisma/R2 unless explicitly re-enabled. Execution remains blocked.
  if (process.env.TASK_RETENTION_CRON_ENABLED !== "true") {
    return NextResponse.json({
      skipped: true,
      reason:
        "TASK_RETENTION_CRON_ENABLED is not true; dry-run disabled to protect session pool",
      code: "RETENTION_CRON_DISABLED",
      executionEnabled: false,
    });
  }

  const execute = process.env[RETENTION_EXECUTE_ENV] === "true";
  // Execution uses scrub-first CAS in `runTaskRetention` (clear URL refs under
  // retentionCleanedAt=null, re-check shared keys, then delete). Still requires
  // the explicit TASK_RETENTION_EXECUTE=true env; request params cannot enable it.
  const configuredR2Url = process.env.R2_URL_BASE;
  if (!configuredR2Url) {
    return NextResponse.json(
      { error: "R2_URL_BASE is not configured" },
      { status: 503 },
    );
  }

  try {
    const report = await runTaskRetention({
      db: prisma as any,
      storage: createR2S3Service(),
      configuredR2Url,
      dryRun: !execute,
      batchSize: configuredBatchSize(),
    });
    return NextResponse.json({ ...report, executionEnabled: execute });
  } catch (error) {
    console.error("Task retention cleanup failed", error);
    return NextResponse.json(
      { error: "retention cleanup failed" },
      { status: 500 },
    );
  }
}

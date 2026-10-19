#!/usr/bin/env node

/**
 * Read-only production release preflight.
 *
 * The command intentionally reports environment variable names and status only;
 * it never prints variable values, connection strings, row data, or secrets.
 * Database checks use information_schema/pg_indexes and migration metadata reads.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_ENV = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_GA_ID",
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY",
  "R2_SECRET_KEY",
  "R2_URL_BASE",
  "R2_BUCKET",
  "R2_ACCOUNT_ID",
  "RUNNINGHUB_API_BASE_URL",
  "RUNNINGHUB_API_KEY",
  "RUNNINGHUB_OBJECT_DETECT_WORKFLOW_ID",
  "RUNNINGHUB_OBJECT_SEGMENT_WORKFLOW_ID",
  "RUNNINGHUB_OBJECT_REMOVE_WORKFLOW_ID",
  "RUNNINGHUB_OUTPUT_URL_PREFIXES",
  "RUNNINGHUB_WEBHOOK_SECRET",
  "CRON_SECRET",
  "TASK_HEADER_KEY",
  "WEBHOOK_SECRET",
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CLOUDFLARE_AI_GATEWAY_URL",
  "CLOUDFLARE_AI_GATEWAY_TOKEN",
  "REPLICATE_API_TOKEN",
];

// These values are only needed by the GitHub/Cloudflare deployment workflow.
// They must not be added to Vercel's runtime environment merely to satisfy a
// deploy check. The report includes their status as informational context.
export const DEPLOYMENT_ENV = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];

export const REQUIRED_TABLE_COLUMNS = {
  users: ["id"],
  task_data: [
    "id",
    "user_id",
    "task_status",
    "expires_at",
    "retry_count",
    "idempotency_key",
    "retention_checked_at",
    "retention_cleaned_at",
  ],
  background_removal_tasks: [
    "id",
    "user_id",
    "task_status",
    "expires_at",
    "retry_count",
    "idempotency_key",
    "retention_checked_at",
    "retention_cleaned_at",
  ],
  watermark_removal_tasks: [
    "id",
    "user_id",
    "task_status",
    "expires_at",
    "retry_count",
    "idempotency_key",
    "authorization_confirmed",
    "authorization_policy_version",
    "authorization_subject",
    "authorization_confirmed_at",
    "audit_expires_at",
    "retention_checked_at",
    "retention_cleaned_at",
  ],
  object_removal_tasks: [
    "id",
    "user_id",
    "task_status",
    "expires_at",
    "retry_count",
    "idempotency_key",
    "authorization_confirmed",
    "authorization_policy_version",
    "authorization_subject",
    "authorization_confirmed_at",
    "audit_expires_at",
    "retention_checked_at",
    "retention_cleaned_at",
  ],
  background_compositions: [
    "id",
    "user_id",
    "foreground_image_url",
    "background_type",
    "background_data",
    "composition_params",
    "status",
    "result_image_url",
  ],
};

export const REQUIRED_INDEXES = {
  task_data: ["task_data_retention_idx"],
  background_removal_tasks: [
    "background_removal_tasks_principal_created_idx",
    "background_removal_tasks_user_created_idx",
    "background_removal_tasks_idempotency_idx",
    "background_removal_tasks_retention_idx",
  ],
  watermark_removal_tasks: [
    "watermark_removal_tasks_idempotency_idx",
    "watermark_removal_tasks_retention_idx",
    "watermark_removal_tasks_audit_expires_at_idx",
  ],
  object_removal_tasks: [
    "object_removal_tasks_idempotency_idx",
    "object_removal_tasks_retention_idx",
    "object_removal_tasks_audit_expires_at_idx",
  ],
};

export const EXPECTED_MIGRATIONS = [
  "0002_task_lifecycle.sql",
  "0003_authorization_audit.sql",
  "0004_task_retention.sql",
];

const PLACEHOLDER_RE =
  /(placeholder|your[-_ ]|replace[-_ ]?me|example\.(com|test)|localhost|127\.0\.0\.1|^file:)/i;

function isUnset(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function classifyEnvValue(value) {
  if (isUnset(value)) return "missing";
  return PLACEHOLDER_RE.test(String(value).trim()) ? "placeholder" : "set";
}

export function inspectEnvironment(environment = process.env) {
  const entries = REQUIRED_ENV.map((name) => ({
    name,
    status: classifyEnvValue(environment[name]),
  }));
  return {
    entries,
    deploymentEntries: DEPLOYMENT_ENV.map((name) => ({
      name,
      status: classifyEnvValue(environment[name]),
    })),
    blockers: entries
      .filter((entry) => entry.status !== "set")
      .map((entry) => `environment variable ${entry.name} is ${entry.status}`),
  };
}

function migrationPath(name) {
  return path.join(root, "db", "migrations", name);
}

export function inspectMigrationFiles() {
  return EXPECTED_MIGRATIONS.map((name) => {
    const filename = migrationPath(name);
    if (!fs.existsSync(filename)) {
      return { name, status: "missing", checksum: null };
    }
    const checksum = crypto
      .createHash("sha256")
      .update(fs.readFileSync(filename))
      .digest("hex");
    return { name, status: "present", checksum };
  });
}

function safeErrorKind(error) {
  if (!error || typeof error !== "object") return "unknown";
  if (typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code)) {
    return error.code;
  }
  if (error.name === "Error" || typeof error.name === "string")
    return error.name;
  return "unknown";
}

async function loadPostgres() {
  try {
    const module = await import("postgres");
    return module.default;
  } catch {
    return null;
  }
}

async function queryDatabase(databaseUrl) {
  const postgres = await loadPostgres();
  if (!postgres) {
    return {
      status: "error",
      blockers: ["postgres client dependency is unavailable"],
    };
  }

  let sql;
  try {
    sql = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 5,
      prepare: false,
    });

    const tables = {};
    const indexes = {};
    for (const table of Object.keys(REQUIRED_TABLE_COLUMNS)) {
      const rows = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
      `;
      tables[table] = rows.map((row) => String(row.column_name));

      if (REQUIRED_INDEXES[table]) {
        const indexRows = await sql`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = ${table}
        `;
        indexes[table] = indexRows.map((row) => String(row.indexname));
      }
    }

    const migrationTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('_prisma_migrations', '__drizzle_migrations', 'drizzle_migrations')
    `;
    const migrationTrackingTables = migrationTables.map((row) =>
      String(row.table_name),
    );

    const migrationRows = {};
    if (migrationTrackingTables.includes("_prisma_migrations")) {
      const rows = await sql`
        SELECT migration_name, checksum, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY started_at ASC
      `;
      migrationRows._prisma_migrations = rows.map((row) => ({
        name: String(row.migration_name),
        checksum: typeof row.checksum === "string" ? row.checksum : null,
        finished: Boolean(row.finished_at),
        rolledBack: Boolean(row.rolled_back_at),
      }));
    }

    return {
      status: "ok",
      tables,
      indexes,
      migrationTrackingTables,
      migrationRows,
      blockers: [],
    };
  } catch (error) {
    return {
      status: "error",
      errorKind: safeErrorKind(error),
      blockers: [`database read failed (${safeErrorKind(error)})`],
    };
  } finally {
    if (sql) {
      try {
        await sql.end({ timeout: 1 });
      } catch {
        // Closing a failed read-only connection has no release impact.
      }
    }
  }
}

export function compareDatabaseSchema(database) {
  const blockers = [];
  if (database.status !== "ok") return blockers;

  for (const [table, requiredColumns] of Object.entries(
    REQUIRED_TABLE_COLUMNS,
  )) {
    const columns = database.tables[table] || [];
    const actual = new Set(columns);
    if (!columns.length) {
      blockers.push(`database table ${table} is missing`);
      continue;
    }
    for (const column of requiredColumns) {
      if (!actual.has(column))
        blockers.push(`database column ${table}.${column} is missing`);
    }
  }

  for (const [table, requiredIndexes] of Object.entries(REQUIRED_INDEXES)) {
    const actual = new Set(database.indexes[table] || []);
    for (const index of requiredIndexes) {
      if (!actual.has(index))
        blockers.push(`database index ${index} is missing`);
    }
  }
  return blockers;
}

export function compareMigrationState(database, migrationFiles) {
  const blockers = migrationFiles
    .filter((entry) => entry.status !== "present")
    .map((entry) => `migration file ${entry.name} is ${entry.status}`);
  if (database.status !== "ok") return blockers;

  const prismaRows = database.migrationRows?._prisma_migrations || [];
  if (!database.migrationTrackingTables.length) {
    blockers.push("database migration tracking table is unavailable");
    return blockers;
  }

  // These SQL patches live under db/migrations rather than Prisma's migration
  // directory. A Prisma row therefore cannot prove that a manual patch ran.
  // Keep the state explicitly blocked until the release ledger/integration
  // evidence records the three statements and their checksums.
  const manualPatchNames = migrationFiles
    .filter((entry) => entry.status === "present")
    .map((entry) => entry.name);
  if (manualPatchNames.length) {
    blockers.push(
      `manual migration state is unverified for ${manualPatchNames.join(", ")}; record applied checksums in the release ledger`,
    );
  }
  if (prismaRows.some((row) => !row.finished || row.rolledBack)) {
    blockers.push(
      "database migration ledger contains unfinished or rolled-back entries",
    );
  }
  return blockers;
}

export async function runPreflight({
  environment = process.env,
  skipDatabase = false,
} = {}) {
  const env = inspectEnvironment(environment);
  const migrations = inspectMigrationFiles();
  let database = {
    status: "skipped",
    blockers: skipDatabase
      ? ["database check skipped by PREFLIGHT_SKIP_DB=1"]
      : ["database check not run"],
  };

  const databaseUrlStatus = classifyEnvValue(environment.DATABASE_URL);
  if (!skipDatabase && databaseUrlStatus === "set") {
    database = await queryDatabase(environment.DATABASE_URL);
  } else if (!skipDatabase) {
    database = {
      status: "skipped",
      blockers: [
        "database check skipped because DATABASE_URL is not configured",
      ],
    };
  }

  const blockers = [...env.blockers];
  if (database.status === "ok") {
    blockers.push(...compareDatabaseSchema(database));
    blockers.push(...compareMigrationState(database, migrations));
  } else {
    blockers.push(...database.blockers);
  }

  return {
    ok: blockers.length === 0,
    environment: env,
    migrations,
    database,
    blockers,
  };
}

function statusLabel(status) {
  return status === "set" ? "OK" : status.toUpperCase();
}

export function formatReport(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify(
      {
        ok: result.ok,
        environment: result.environment,
        migrations: result.migrations,
        database: result.database,
        blockers: result.blockers,
      },
      null,
      2,
    )}\n`;
  }

  const lines = [
    "Remove Anything production preflight (read-only)",
    "",
    "Environment:",
  ];
  for (const entry of result.environment.entries) {
    lines.push(`- ${entry.name}: ${statusLabel(entry.status)}`);
  }
  lines.push(
    "",
    "Deployment workflow variables (informational; not Vercel runtime requirements):",
  );
  for (const entry of result.environment.deploymentEntries) {
    lines.push(`- ${entry.name}: ${statusLabel(entry.status)}`);
  }
  lines.push("", "Migration files:");
  for (const migration of result.migrations) {
    lines.push(
      `- ${migration.name}: ${migration.status}${migration.checksum ? ` (${migration.checksum.slice(0, 12)}…)` : ""}`,
    );
  }
  lines.push("", `Database: ${result.database.status.toUpperCase()}`);
  if (result.database.status === "ok") {
    for (const table of Object.keys(REQUIRED_TABLE_COLUMNS)) {
      const columns = new Set(result.database.tables[table] || []);
      const missing = REQUIRED_TABLE_COLUMNS[table].filter(
        (column) => !columns.has(column),
      );
      lines.push(
        `- ${table}: ${missing.length ? `MISSING ${missing.join(", ")}` : "OK"}`,
      );
    }
    for (const [table, requiredIndexes] of Object.entries(REQUIRED_INDEXES)) {
      const indexes = new Set(result.database.indexes[table] || []);
      const missing = requiredIndexes.filter((index) => !indexes.has(index));
      lines.push(
        `- indexes ${table}: ${missing.length ? `MISSING ${missing.join(", ")}` : "OK"}`,
      );
    }
    lines.push(
      `- migration tracking: ${result.database.migrationTrackingTables.join(", ") || "unavailable"}`,
    );
  } else if (result.database.blockers?.length) {
    for (const blocker of result.database.blockers) lines.push(`- ${blocker}`);
  }

  lines.push("", result.ok ? "Preflight passed." : "Preflight blocked:");
  if (!result.ok) {
    for (const blocker of result.blockers) lines.push(`- ${blocker}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function main(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  const json = argv.includes("--json");
  const skipDatabase =
    argv.includes("--skip-db") || environment.PREFLIGHT_SKIP_DB === "1";
  const result = await runPreflight({ environment, skipDatabase });
  process.stdout.write(formatReport(result, { json }));
  return result.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = await main();
}

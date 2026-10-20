#!/usr/bin/env node

/**
 * Read-only production release preflight.
 *
 * The command intentionally reports environment variable names and status only;
 * it never prints variable values, connection strings, row data, or secrets.
 * Database checks use information_schema/pg_catalog and migration metadata reads.
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
  "RUNNINGHUB_OUTPUT_URL_PREFIXES",
  "CRON_SECRET",
  "TASK_HEADER_KEY",
  "WEBHOOK_SECRET",
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CLOUDFLARE_AI_GATEWAY_URL",
  "REPLICATE_API_TOKEN",
];

// The RunningHub SDK falls back only when these overrides are absent or empty.
// Explicit placeholders remain blockers because they override the SDK defaults.
const DEFAULTED_ENV = [
  "RUNNINGHUB_OBJECT_SEGMENT_WORKFLOW_ID",
  "RUNNINGHUB_OBJECT_REMOVE_WORKFLOW_ID",
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
    "principal_id",
    "created_at",
    "updated_at",
    "task_status",
    "expires_at",
    "retry_count",
    "idempotency_key",
    "retention_checked_at",
    "retention_cleaned_at",
    "audit_expires_at",
  ],
  background_removal_tasks: [
    "id",
    "user_id",
    "principal_id",
    "created_at",
    "updated_at",
    "task_status",
    "expires_at",
    "retry_count",
    "idempotency_key",
    "retention_checked_at",
    "retention_cleaned_at",
    "audit_expires_at",
  ],
  watermark_removal_tasks: [
    "id",
    "user_id",
    "principal_id",
    "created_at",
    "updated_at",
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
    "principal_id",
    "created_at",
    "updated_at",
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
  task_data: ["task_data_retention_idx", "task_data_audit_expires_at_idx"],
  background_removal_tasks: [
    "background_removal_tasks_principal_created_idx",
    "background_removal_tasks_user_created_idx",
    "background_removal_tasks_idempotency_idx",
    "background_removal_tasks_retention_idx",
    "background_removal_tasks_audit_expires_at_idx",
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

const INDEX_COLUMNS = {
  task_data_retention_idx: [
    "retention_cleaned_at",
    "retention_checked_at",
    "expires_at",
  ],
  task_data_audit_expires_at_idx: ["audit_expires_at"],
  background_removal_tasks_principal_created_idx: [
    "principal_id",
    "created_at",
  ],
  background_removal_tasks_user_created_idx: ["user_id", "created_at"],
  background_removal_tasks_idempotency_idx: ["idempotency_key"],
  background_removal_tasks_retention_idx: [
    "retention_cleaned_at",
    "retention_checked_at",
    "expires_at",
  ],
  background_removal_tasks_audit_expires_at_idx: ["audit_expires_at"],
  watermark_removal_tasks_idempotency_idx: ["idempotency_key"],
  watermark_removal_tasks_retention_idx: [
    "retention_cleaned_at",
    "retention_checked_at",
    "expires_at",
  ],
  watermark_removal_tasks_audit_expires_at_idx: ["audit_expires_at"],
  object_removal_tasks_idempotency_idx: ["idempotency_key"],
  object_removal_tasks_retention_idx: [
    "retention_cleaned_at",
    "retention_checked_at",
    "expires_at",
  ],
  object_removal_tasks_audit_expires_at_idx: ["audit_expires_at"],
};

const P0_COLUMN_RULES = {
  principal_id: { type: "text", nullable: true },
  expires_at: {
    type: "timestamp without time zone",
    nullable: true,
    precision: 3,
  },
  retry_count: { type: "integer", nullable: false, default: "0" },
  idempotency_key: { type: "text", nullable: true },
  retention_checked_at: {
    type: "timestamp without time zone",
    nullable: true,
    precision: 3,
  },
  retention_cleaned_at: {
    type: "timestamp without time zone",
    nullable: true,
    precision: 3,
  },
  authorization_confirmed: {
    type: "boolean",
    nullable: false,
    default: "false",
  },
  authorization_policy_version: { type: "text", nullable: true },
  authorization_subject: { type: "text", nullable: true },
  authorization_confirmed_at: {
    type: "timestamp without time zone",
    nullable: true,
    precision: 3,
  },
  audit_expires_at: {
    type: "timestamp without time zone",
    nullable: true,
    precision: 3,
  },
};

// Production was reconciled by the guarded one-time cutover. That migration
// contains the lifecycle, authorization, retention, TaskData array defaults,
// and remaining baseline DDL in one transaction. The earlier 0002-0006 files
// remain useful for isolated rehearsal/history, but a production receipt must
// describe the migration that was actually applied rather than claim those
// superseded files ran independently.
export const EXPECTED_MIGRATIONS = [
  "0007_production_baseline_reconciliation.sql",
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
  const entries = [
    ...REQUIRED_ENV.map((name) => ({
      name,
      status: classifyEnvValue(environment[name]),
    })),
    ...DEFAULTED_ENV.map((name) => ({
      name,
      status: !environment[name]
        ? "default"
        : classifyEnvValue(environment[name]),
    })),
  ];
  const blockers = entries
    .filter((entry) => !["set", "default"].includes(entry.status))
    .map((entry) => `environment variable ${entry.name} is ${entry.status}`);
  for (const name of [
    "NEXT_PUBLIC_SITE_URL",
    "NEXTAUTH_URL",
    "R2_ENDPOINT",
    "R2_URL_BASE",
    "RUNNINGHUB_API_BASE_URL",
    "CLOUDFLARE_AI_GATEWAY_URL",
  ]) {
    if (classifyEnvValue(environment[name]) !== "set") continue;
    try {
      const url = new URL(environment[name]);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error();
    } catch {
      blockers.push(
        `environment variable ${name} must be a credential-free HTTPS URL`,
      );
    }
  }
  const callbackConfigured = !isUnset(environment.RUNNINGHUB_WEBHOOK_SECRET);
  if (
    callbackConfigured &&
    String(environment.RUNNINGHUB_WEBHOOK_SECRET).length < 32
  ) {
    blockers.push(
      "RUNNINGHUB_WEBHOOK_SECRET must contain at least 32 characters when callbacks are configured",
    );
  }
  return {
    entries,
    deploymentEntries: DEPLOYMENT_ENV.map((name) => ({
      name,
      status: classifyEnvValue(environment[name]),
    })),
    info: [
      ...entries
        .filter((entry) => entry.status === "default")
        .map(
          ({ name }) =>
            `${name} uses the SDK built-in workflow default; provider access still requires verification`,
        ),
      "CLOUDFLARE_AI_GATEWAY_TOKEN is optional and unused by the current AI Gateway runtime; no token needs to be requested for this preflight",
      callbackConfigured
        ? "RunningHub callbacks configured; provider delivery still requires verification"
        : "RunningHub callbacks not configured; polling-only mode is supported",
    ],
    blockers,
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
  const code = error?.code;
  if (["28P01", "28000"].includes(code)) return "authentication";
  if (code === "42501") return "permission";
  if (
    [
      "ECONNREFUSED",
      "ENOTFOUND",
      "ECONNRESET",
      "ETIMEDOUT",
      "CONNECT_TIMEOUT",
    ].includes(code)
  )
    return "connection";
  if (code === "57014") return "timeout";
  return "database";
}

async function loadPostgres() {
  try {
    const module = await import("postgres");
    return module.default;
  } catch {
    return null;
  }
}

export async function queryDatabase(databaseUrl, factory) {
  const postgres = factory || (await loadPostgres());
  if (!postgres) {
    return {
      status: "error",
      blockers: ["postgres client dependency is unavailable"],
    };
  }

  let sql;
  try {
    targetFingerprint(databaseUrl);
    sql = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 5,
      prepare: false,
      connection: {
        statement_timeout: "10000",
        default_transaction_read_only: true,
      },
      onnotice: () => {},
    });

    const tables = {};
    const indexes = {};
    for (const table of Object.keys(REQUIRED_TABLE_COLUMNS)) {
      const rows = await sql`
        SELECT column_name, data_type, is_nullable, column_default, datetime_precision
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
      `;
      tables[table] = rows.map((row) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
        default: row.column_default,
        precision: row.datetime_precision,
      }));

      if (REQUIRED_INDEXES[table]) {
        const indexRows = await sql`
          SELECT c.relname AS name, i.indisvalid AS valid, i.indisready AS ready,
            i.indisunique AS is_unique, am.amname AS method,
            i.indpred IS NOT NULL AS is_partial,
            i.indexprs IS NOT NULL AS has_expressions,
            ARRAY(SELECT pg_get_indexdef(i.indexrelid, n, true)
              FROM generate_series(1, i.indnkeyatts) n ORDER BY n) AS columns,
            i.indnatts - i.indnkeyatts AS included_columns
          FROM pg_index i
          JOIN pg_class c ON c.oid = i.indexrelid
          JOIN pg_class t ON t.oid = i.indrelid
          JOIN pg_namespace ns ON ns.oid = t.relnamespace
          JOIN pg_am am ON am.oid = c.relam
          WHERE ns.nspname = 'public' AND t.relname = ${table}
        `;
        indexes[table] = indexRows;
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
    const actual = new Map(columns.map((column) => [column.name, column]));
    if (!columns.length) {
      blockers.push(`database table ${table} is missing`);
      continue;
    }
    for (const column of requiredColumns) {
      if (!actual.has(column)) {
        blockers.push(`database column ${table}.${column} is missing`);
        continue;
      }
      const expected = P0_COLUMN_RULES[column];
      if (!expected) continue;
      const metadata = actual.get(column);
      const differences = [];
      if (metadata.type !== expected.type) differences.push("type");
      if (metadata.nullable !== expected.nullable)
        differences.push("nullability");
      if (
        expected.precision !== undefined &&
        Number(metadata.precision) !== expected.precision
      )
        differences.push("timestamp precision");
      const defaultValue =
        metadata.default === null || metadata.default === undefined
          ? null
          : String(metadata.default)
              .replace(/::(?:integer|boolean)$/, "")
              .replace(/^'|'$/g, "")
              .trim();
      if (defaultValue !== (expected.default ?? null))
        differences.push("default");
      if (differences.length)
        blockers.push(
          `database column ${table}.${column} has incompatible ${differences.join(", ")}`,
        );
    }
  }

  for (const [table, requiredIndexes] of Object.entries(REQUIRED_INDEXES)) {
    const actual = new Map(
      (database.indexes[table] || []).map((index) => [index.name, index]),
    );
    for (const index of requiredIndexes) {
      if (!actual.has(index)) {
        blockers.push(`database index ${index} is missing`);
        continue;
      }
      const metadata = actual.get(index);
      if (!metadata.valid || !metadata.ready)
        blockers.push(`database index ${index} is not valid and ready`);
      if (
        metadata.method !== "btree" ||
        metadata.is_unique ||
        metadata.is_partial ||
        metadata.has_expressions ||
        Number(metadata.included_columns) !== 0 ||
        JSON.stringify(metadata.columns) !==
          JSON.stringify(INDEX_COLUMNS[index])
      ) {
        blockers.push(
          `database index ${index} has an incompatible definition or column order`,
        );
      }
    }
  }
  return blockers;
}

export function targetFingerprint(databaseUrl) {
  const url = new URL(databaseUrl);
  // postgres.js forwards unknown query parameters into the startup message,
  // where they can override the account/database or the read-only safeguards.
  const unsafeParameters = new Set([
    "user",
    "database",
    "options",
    "role",
    "session_authorization",
    "default_transaction_read_only",
    "statement_timeout",
  ]);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    url.pathname.length < 2 ||
    [...url.searchParams.keys()].some((name) =>
      unsafeParameters.has(name.toLowerCase()),
    )
  )
    throw new Error("invalid database target");
  const target = JSON.stringify({
    host: url.hostname.toLowerCase(),
    port: url.port || "5432",
    // Match postgres.js, which sends the URL path without percent-decoding it.
    database: url.pathname.slice(1),
    // Shared poolers can route projects by username while sharing host/db.
    // Decode URL escaping, preserving case because role names can differ by case.
    account: decodeURIComponent(url.username),
  });
  return crypto.createHash("sha256").update(target).digest("hex");
}

function readReceipt(receiptPath) {
  if (!receiptPath) return { status: "missing" };
  try {
    if (fs.statSync(receiptPath).size > 65_536) return { status: "invalid" };
    return {
      status: "loaded",
      value: JSON.parse(fs.readFileSync(receiptPath, "utf8")),
    };
  } catch {
    return { status: "invalid" };
  }
}

function parseUtcInstant(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  )
    return NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return NaN;
  const normalized = value.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_, fraction) => `.${(fraction || "").padEnd(3, "0")}Z`,
  );
  // Date.parse normalizes impossible calendar dates and 24:00; reject them.
  return new Date(parsed).toISOString() === normalized ? parsed : NaN;
}

export function validateReceipt(
  receipt,
  fingerprint,
  migrationFiles,
  now = Date.now(),
) {
  if (
    !receipt ||
    receipt.version !== 1 ||
    receipt.targetFingerprint !== fingerprint ||
    !/^[a-f0-9]{64}$/.test(fingerprint || "")
  )
    return [
      "manual migration receipt is missing, invalid, or targets a different database",
    ];
  if (
    !Array.isArray(receipt.patches) ||
    receipt.patches.length !== EXPECTED_MIGRATIONS.length
  )
    return ["manual migration receipt must contain all current P0 patches"];
  const blockers = [];
  const names = new Set();
  for (const expected of migrationFiles) {
    const matches = receipt.patches.filter(
      (patch) => patch?.name === expected.name,
    );
    const patch = matches[0];
    if (matches.length !== 1 || names.has(expected.name)) {
      blockers.push(
        `manual migration receipt is missing or duplicates ${expected.name}`,
      );
      continue;
    }
    names.add(expected.name);
    if (
      expected.status !== "present" ||
      patch.checksum !== expected.checksum ||
      !/^[a-f0-9]{64}$/.test(patch.checksum || "")
    )
      blockers.push(
        `manual migration receipt checksum does not match ${expected.name}`,
      );
    const appliedAt = parseUtcInstant(patch.appliedAt);
    if (!Number.isFinite(appliedAt) || appliedAt > now)
      blockers.push(
        `manual migration receipt has invalid appliedAt for ${expected.name}`,
      );
  }
  return blockers;
}

export function compareMigrationState(
  database,
  migrationFiles,
  receipt,
  fingerprint,
) {
  const blockers = migrationFiles
    .filter((entry) => entry.status !== "present")
    .map((entry) => `migration file ${entry.name} is ${entry.status}`);
  if (database.status !== "ok") return blockers;

  const prismaRows = database.migrationRows?._prisma_migrations || [];
  // These SQL patches live under db/migrations rather than Prisma's migration
  // directory. A Prisma row therefore cannot prove that a manual patch ran.
  // Keep the state explicitly blocked until the release ledger/integration
  // evidence records the three statements and their checksums.
  blockers.push(...validateReceipt(receipt, fingerprint, migrationFiles));
  if (prismaRows.some((row) => !row.finished && !row.rolledBack)) {
    blockers.push("database migration ledger contains pending entries");
  }
  return blockers;
}

export async function runPreflight({
  environment = process.env,
  skipDatabase = false,
  receiptPath,
  databaseReader = queryDatabase,
} = {}) {
  const env = inspectEnvironment(environment);
  const migrations = inspectMigrationFiles();
  const receipt = readReceipt(receiptPath);
  let fingerprint;
  try {
    fingerprint = targetFingerprint(environment.DATABASE_URL);
  } catch {
    /* Report a fixed error below. */
  }
  let database = {
    status: "skipped",
    blockers: skipDatabase
      ? ["database check skipped by PREFLIGHT_SKIP_DB=1"]
      : ["database check not run"],
  };

  const databaseUrlStatus = classifyEnvValue(environment.DATABASE_URL);
  if (!skipDatabase && databaseUrlStatus === "set" && fingerprint) {
    database = await databaseReader(environment.DATABASE_URL);
  } else if (!skipDatabase) {
    database = {
      status: "skipped",
      blockers: [
        databaseUrlStatus === "set"
          ? "database check skipped because DATABASE_URL has an invalid or ambiguous target"
          : "database check skipped because DATABASE_URL is not configured",
      ],
    };
  }

  const blockers = [...env.blockers];
  if (database.status === "ok") {
    blockers.push(...compareDatabaseSchema(database));
    blockers.push(
      ...compareMigrationState(
        database,
        migrations,
        receipt.value,
        fingerprint,
      ),
    );
  } else {
    blockers.push(...database.blockers);
  }

  // Never return raw metadata defaults, migration row names, or error payloads.
  const summary = {
    status: database.status,
    blockers: database.blockers,
    migrationTrackingTables: database.migrationTrackingTables,
    schemaBlockers:
      database.status === "ok" ? compareDatabaseSchema(database) : [],
  };
  return {
    ok: blockers.length === 0,
    environment: env,
    migrations,
    database: summary,
    targetFingerprint: fingerprint,
    receiptStatus:
      receipt.status === "loaded" &&
      !validateReceipt(receipt.value, fingerprint, migrations).length
        ? "verified"
        : receipt.status === "missing"
          ? "missing"
          : "invalid",
    scope:
      "This read-only environment/schema preflight does not establish full-spec release readiness.",
    blockers,
  };
}

function statusLabel(status) {
  return status === "set" ? "OK" : status.toUpperCase();
}

export function formatReport(result, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  const lines = [
    "Remove Anything production preflight (read-only)",
    "",
    "Environment:",
  ];
  for (const entry of result.environment.entries) {
    lines.push(`- ${entry.name}: ${statusLabel(entry.status)}`);
  }
  for (const info of result.environment.info) lines.push(`- INFO: ${info}`);
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
    lines.push(
      `- schema definitions: ${result.database.schemaBlockers.length ? "BLOCKED" : "OK"}`,
    );
    lines.push(
      `- migration tracking: ${result.database.migrationTrackingTables.join(", ") || "unavailable"}`,
    );
  } else if (result.database.blockers?.length) {
    for (const blocker of result.database.blockers) lines.push(`- ${blocker}`);
  }
  lines.push(
    `- target fingerprint: ${result.targetFingerprint || "unavailable"}`,
    `- manual migration receipt: ${result.receiptStatus}`,
  );

  lines.push("", result.ok ? "Preflight passed." : "Preflight blocked:");
  if (!result.ok) {
    for (const blocker of result.blockers) lines.push(`- ${blocker}`);
  }
  lines.push("", result.scope);
  return `${lines.join("\n")}\n`;
}

export async function main(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  const json = argv.includes("--json");
  const skipDatabase =
    argv.includes("--skip-db") || environment.PREFLIGHT_SKIP_DB === "1";
  if (argv.includes("--target-fingerprint")) {
    try {
      process.stdout.write(`${targetFingerprint(environment.DATABASE_URL)}\n`);
      return 0;
    } catch {
      process.stdout.write(
        "Cannot fingerprint database target: invalid DATABASE_URL\n",
      );
      return 1;
    }
  }
  const receiptIndex = argv.indexOf("--migration-receipt");
  const receiptPath = receiptIndex >= 0 ? argv[receiptIndex + 1] : undefined;
  const result = await runPreflight({ environment, skipDatabase, receiptPath });
  process.stdout.write(formatReport(result, { json }));
  return result.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = await main();
}

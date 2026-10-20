import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compareDatabaseSchema,
  compareMigrationState,
  DEPLOYMENT_ENV,
  EXPECTED_MIGRATIONS,
  formatReport,
  inspectEnvironment,
  inspectMigrationFiles,
  queryDatabase,
  REQUIRED_ENV,
  runPreflight,
  targetFingerprint,
  validateReceipt,
} from "../../scripts/production-preflight.mjs";

const databaseUrl =
  "postgresql://user:secret@production.internal:5432/app?sslmode=require";
function validEnvironment() {
  return {
    ...Object.fromEntries(REQUIRED_ENV.map((name) => [name, "configured"])),
    DATABASE_URL: databaseUrl,
    ...Object.fromEntries(
      [
        "NEXT_PUBLIC_SITE_URL",
        "NEXTAUTH_URL",
        "R2_ENDPOINT",
        "R2_URL_BASE",
        "RUNNINGHUB_API_BASE_URL",
        "CLOUDFLARE_AI_GATEWAY_URL",
      ].map((name) => [name, "https://service.internal"]),
    ),
  };
}
function validReceipt() {
  return {
    version: 1,
    targetFingerprint: targetFingerprint(databaseUrl),
    patches: inspectMigrationFiles().map(({ name, checksum }) => ({
      name,
      checksum,
      appliedAt: "2026-01-01T00:00:00Z",
    })),
  };
}

test("production preflight reports environment names without exposing values", async () => {
  const secret = "super-secret-value-that-must-not-appear";
  const result = await runPreflight({
    environment: {
      DATABASE_URL: "postgresql://user:password@example.test/db",
      NEXT_PUBLIC_SITE_URL: "https://remove-anything.com",
      CRON_SECRET: secret,
    },
    skipDatabase: true,
  });

  const report = formatReport(result);
  assert.match(report, /DATABASE_URL: PLACEHOLDER/);
  assert.match(report, /NEXTAUTH_SECRET: MISSING/);
  assert.match(report, /CLOUDFLARE_API_TOKEN: MISSING/);
  assert.doesNotMatch(report, /password/);
  assert.doesNotMatch(report, new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(result), /password/);
  assert.equal(result.ok, false);
});

test("environment inspection distinguishes missing, placeholder, and configured values", () => {
  const result = inspectEnvironment({
    DATABASE_URL: "file:./dev.db",
    NEXT_PUBLIC_SITE_URL: "https://remove-anything.com",
    R2_BUCKET: "production-results",
  });
  assert.equal(
    result.entries.find((entry) => entry.name === "DATABASE_URL").status,
    "placeholder",
  );
  assert.equal(
    result.entries.find((entry) => entry.name === "NEXT_PUBLIC_SITE_URL")
      .status,
    "set",
  );
  assert.equal(
    result.entries.find((entry) => entry.name === "R2_BUCKET").status,
    "set",
  );
  assert.equal(result.deploymentEntries.length, DEPLOYMENT_ENV.length);
  assert.equal(REQUIRED_ENV.includes("DATABASE_URL"), true);
});

test("SDK workflow defaults are informational while explicit placeholders and required configuration block", () => {
  const workflowNames = [
    "RUNNINGHUB_OBJECT_SEGMENT_WORKFLOW_ID",
    "RUNNINGHUB_OBJECT_REMOVE_WORKFLOW_ID",
  ];
  for (const value of [undefined, null, ""]) {
    const environment = validEnvironment();
    for (const name of workflowNames) environment[name] = value;
    const result = inspectEnvironment(environment);
    assert.deepEqual(result.blockers, []);
    for (const name of workflowNames) {
      assert.equal(REQUIRED_ENV.includes(name), false);
      assert.equal(
        result.entries.find((entry) => entry.name === name).status,
        "default",
      );
      assert.ok(result.info.some((info) => info.includes(name)));
    }
  }
  for (const name of workflowNames) {
    for (const value of ["placeholder", "your-workflow-id", " "]) {
      const result = inspectEnvironment({
        ...validEnvironment(),
        [name]: value,
      });
      assert.ok(result.blockers.some((blocker) => blocker.includes(name)));
      assert.notEqual(
        result.entries.find((entry) => entry.name === name).status,
        "default",
      );
    }
  }
  for (const name of [
    "RUNNINGHUB_OBJECT_DETECT_WORKFLOW_ID",
    "RUNNINGHUB_OUTPUT_URL_PREFIXES",
    "TASK_HEADER_KEY",
    "STRIPE_API_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]) {
    assert.equal(REQUIRED_ENV.includes(name), true);
    const result = inspectEnvironment({
      ...validEnvironment(),
      [name]: undefined,
    });
    assert.ok(result.blockers.some((blocker) => blocker.includes(name)));
  }
});

test("unused AI Gateway token remains optional and environment info never includes values", () => {
  assert.equal(REQUIRED_ENV.includes("CLOUDFLARE_AI_GATEWAY_TOKEN"), false);
  for (const token of [undefined, "placeholder", "gateway-secret-value"]) {
    const environment = {
      ...validEnvironment(),
      CLOUDFLARE_AI_GATEWAY_TOKEN: token,
      RUNNINGHUB_OBJECT_SEGMENT_WORKFLOW_ID: "segment-secret-value",
      RUNNINGHUB_OBJECT_REMOVE_WORKFLOW_ID: "remove-secret-value",
    };
    const result = inspectEnvironment(environment);
    assert.deepEqual(result.blockers, []);
    assert.ok(
      result.info.some(
        (info) =>
          info.includes("CLOUDFLARE_AI_GATEWAY_TOKEN") &&
          info.includes("optional"),
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /gateway-secret-value|segment-secret-value|remove-secret-value/,
    );
  }
});

test("migration audit enumerates all checked-in P0 SQL patches with checksums", () => {
  const files = inspectMigrationFiles();
  assert.deepEqual(
    files.map((entry) => entry.name),
    EXPECTED_MIGRATIONS,
  );
  for (const entry of files) {
    assert.equal(entry.status, "present");
    assert.match(entry.checksum, /^[a-f0-9]{64}$/);
  }
});

function validSchema() {
  const schema = {
    status: "ok",
    tables: {
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
    },
    indexes: {
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
    },
  };
  const timestamp = new Set([
    "expires_at",
    "retention_checked_at",
    "retention_cleaned_at",
    "authorization_confirmed_at",
    "audit_expires_at",
  ]);
  for (const columns of Object.values(schema.tables)) {
    columns.splice(
      0,
      columns.length,
      ...columns.map((name) => ({
        name,
        type: timestamp.has(name)
          ? "timestamp without time zone"
          : name === "retry_count"
            ? "integer"
            : name === "authorization_confirmed"
              ? "boolean"
              : "text",
        nullable: !["retry_count", "authorization_confirmed"].includes(name),
        precision: timestamp.has(name) ? 3 : null,
        default:
          name === "retry_count"
            ? "0"
            : name === "authorization_confirmed"
              ? "false"
              : null,
      })),
    );
  }
  for (const [table, indexes] of Object.entries(schema.indexes)) {
    schema.indexes[table] = indexes.map((name) => ({
      name,
      valid: true,
      ready: true,
      method: "btree",
      is_unique: false,
      is_partial: false,
      has_expressions: false,
      included_columns: 0,
      columns: name.endsWith("retention_idx")
        ? ["retention_cleaned_at", "retention_checked_at", "expires_at"]
        : name.endsWith("principal_created_idx")
          ? ["principal_id", "created_at"]
          : name.endsWith("user_created_idx")
            ? ["user_id", "created_at"]
            : name.endsWith("audit_expires_at_idx")
              ? ["audit_expires_at"]
              : ["idempotency_key"],
    }));
  }
  schema.migrationTrackingTables = ["_prisma_migrations"];
  schema.migrationRows = { _prisma_migrations: [] };
  return schema;
}

test("missing principals and incompatible column types, defaults, nullability and timestamp precision fail", () => {
  assert.deepEqual(compareDatabaseSchema(validSchema()), []);
  for (const [field, value] of [
    ["type", "text"],
    ["nullable", true],
    ["default", "9"],
  ]) {
    const schema = validSchema();
    schema.tables.task_data.find((column) => column.name === "retry_count")[
      field
    ] = value;
    assert.match(
      compareDatabaseSchema(schema).join("\n"),
      /task_data.retry_count has incompatible/,
    );
  }
  const schema = validSchema();
  schema.tables.task_data = schema.tables.task_data.filter(
    (column) => column.name !== "principal_id",
  );
  schema.tables.background_removal_tasks.find(
    (column) => column.name === "expires_at",
  ).precision = 6;
  assert.match(
    compareDatabaseSchema(schema).join("\n"),
    /task_data.principal_id is missing/,
  );
  assert.match(compareDatabaseSchema(schema).join("\n"), /timestamp precision/);
});

test("indexes with expected names but invalid state or wrong definition fail", () => {
  for (const mutate of [
    (index) => (index.valid = false),
    (index) => (index.ready = false),
    (index) => index.columns.reverse(),
    (index) => (index.is_partial = true),
    (index) => (index.method = "hash"),
    (index) => (index.included_columns = 1),
  ]) {
    const schema = validSchema();
    mutate(schema.indexes.task_data[0]);
    assert.ok(compareDatabaseSchema(schema).length);
  }
});

test("manual migration receipt must match target, all current checksums and valid timestamps", () => {
  const files = inspectMigrationFiles();
  const fingerprint = targetFingerprint(databaseUrl);
  assert.deepEqual(validateReceipt(validReceipt(), fingerprint, files), []);
  for (const mutate of [
    (receipt) => (receipt.version = 2),
    (receipt) => (receipt.targetFingerprint = "0".repeat(64)),
    (receipt) => receipt.patches.pop(),
    (receipt) => (receipt.patches[0].checksum = "0".repeat(64)),
    (receipt) => (receipt.patches[0].appliedAt = "not-a-date"),
    (receipt) => (receipt.patches[0].appliedAt = "2026-02-30T00:00:00Z"),
    (receipt) => (receipt.patches[0].appliedAt = "2026-02-29T00:00:00Z"),
    (receipt) => (receipt.patches[0].appliedAt = "2026-04-31T00:00:00Z"),
    (receipt) => (receipt.patches[0].appliedAt = "2026-01-01T24:00:00Z"),
    (receipt) => (receipt.patches[0].appliedAt = "2099-01-01T00:00:00Z"),
    (receipt) => (receipt.patches[0] = receipt.patches[1]),
  ]) {
    const receipt = validReceipt();
    mutate(receipt);
    assert.ok(validateReceipt(receipt, fingerprint, files).length);
  }
  assert.ok(validateReceipt(null, fingerprint, files).length);
  assert.equal(
    targetFingerprint(
      "postgresql://user:new@production.internal/app?different=query",
    ),
    fingerprint,
  );
  assert.notEqual(
    targetFingerprint("postgresql://user:secret@production.internal:5433/app"),
    fingerprint,
  );
  assert.notEqual(
    targetFingerprint("postgresql://user:secret@production.internal/other"),
    fingerprint,
  );
});

test("target fingerprints distinguish shared-pooler project accounts without exposing credentials", () => {
  const first = targetFingerprint(
    "postgresql://postgres.project-a:password-one@shared.pooler.internal:6543/postgres?sslmode=require",
  );
  const second = targetFingerprint(
    "postgresql://postgres.project-b:password-two@shared.pooler.internal:6543/postgres?sslmode=require",
  );
  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /postgres|project-a|password-one|sslmode/);
  assert.equal(
    targetFingerprint(
      "postgresql://postgres%2Eproject-a:rotated@SHARED.pooler.internal:6543/postgres?different=query",
    ),
    first,
  );
  assert.notEqual(
    targetFingerprint(
      "postgresql://Postgres.project-a:password-one@shared.pooler.internal:6543/postgres",
    ),
    first,
  );
  assert.throws(() =>
    targetFingerprint("postgresql://shared.pooler.internal/postgres"),
  );
  assert.notEqual(
    targetFingerprint("postgresql://user:secret@production.internal/%61pp"),
    targetFingerprint("postgresql://user:secret@production.internal/app"),
  );
});

test("ambiguous startup parameters cannot bypass the receipt target or read-only settings", async () => {
  for (const parameter of [
    "user",
    "database",
    "options",
    "role",
    "session_authorization",
    "default_transaction_read_only",
    "statement_timeout",
    "%75ser",
  ]) {
    const ambiguousUrl = `${databaseUrl}&${parameter}=secret-query-value`;
    assert.throws(() => targetFingerprint(ambiguousUrl));
    const result = await runPreflight({
      environment: { ...validEnvironment(), DATABASE_URL: ambiguousUrl },
      databaseReader: () => assert.fail("invalid target must not connect"),
    });
    assert.equal(result.ok, false);
    assert.equal(result.database.status, "skipped");
    assert.equal(result.targetFingerprint, undefined);
    assert.doesNotMatch(
      formatReport(result, { json: true }),
      /secret-query-value|user:secret/,
    );
    const direct = await queryDatabase(ambiguousUrl, () =>
      assert.fail("invalid target must not create a client"),
    );
    assert.equal(direct.status, "error");
    assert.doesNotMatch(JSON.stringify(direct), /secret-query-value/);
  }
});

test("receipt appliedAt accepts real UTC dates and supported fractional precision", () => {
  const files = inspectMigrationFiles();
  const receipt = validReceipt();
  for (const appliedAt of [
    "2024-02-29T12:34:56Z",
    "2024-02-29T12:34:56.1Z",
    "2024-02-29T12:34:56.12Z",
    "2024-02-29T12:34:56.123Z",
  ]) {
    receipt.patches[0].appliedAt = appliedAt;
    assert.deepEqual(
      validateReceipt(receipt, receipt.targetFingerprint, files),
      [],
    );
  }
});

test("recorded rollbacks do not block migration evidence while unfinished active rows do", () => {
  const schema = validSchema();
  const receipt = validReceipt();
  schema.migrationRows._prisma_migrations = [
    { finished: false, rolledBack: true },
  ];
  assert.deepEqual(
    compareMigrationState(
      schema,
      inspectMigrationFiles(),
      receipt,
      receipt.targetFingerprint,
    ),
    [],
  );
  schema.migrationRows._prisma_migrations.push({
    finished: false,
    rolledBack: false,
  });
  assert.match(
    compareMigrationState(
      schema,
      inspectMigrationFiles(),
      receipt,
      receipt.targetFingerprint,
    ).join("\n"),
    /pending/,
  );
});

test("callbacks are optional, configured short secrets and non-HTTPS URLs fail", () => {
  const environment = validEnvironment();
  assert.deepEqual(inspectEnvironment(environment).blockers, []);
  assert.match(inspectEnvironment(environment).info.join(""), /polling-only/);
  environment.RUNNINGHUB_WEBHOOK_SECRET = "short";
  environment.R2_ENDPOINT = "http://service.internal";
  const blockers = inspectEnvironment(environment).blockers.join("\n");
  assert.match(blockers, /at least 32/);
  assert.match(blockers, /HTTPS/);
});

test("skip-db cannot claim success with every variable configured", async () => {
  const result = await runPreflight({
    environment: validEnvironment(),
    skipDatabase: true,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.blockers, [
    "database check skipped by PREFLIGHT_SKIP_DB=1",
  ]);
});

test("receipt enables a valid read-only preflight without exposing raw database metadata", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ra-preflight-"));
  try {
    const receiptPath = path.join(directory, "receipt.json");
    fs.writeFileSync(receiptPath, JSON.stringify(validReceipt()));
    const schema = validSchema();
    schema.tables.users[0].default = "secret-db-default-never-print";
    const result = await runPreflight({
      environment: validEnvironment(),
      receiptPath,
      databaseReader: async () => schema,
    });
    assert.equal(result.ok, true, result.blockers.join("\n"));
    assert.equal(result.receiptStatus, "verified");
    assert.doesNotMatch(
      formatReport(result, { json: true }),
      /secret-db-default|user:secret/,
    );
    assert.match(
      formatReport(result),
      /does not establish full-spec release readiness/,
    );
    fs.writeFileSync(receiptPath, "bad json secret-value");
    const invalid = await runPreflight({
      environment: validEnvironment(),
      receiptPath,
      databaseReader: async () => schema,
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.receiptStatus, "invalid");
    assert.doesNotMatch(formatReport(invalid, { json: true }), /secret-value/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("database errors use fixed categories instead of echoing error names or messages", async () => {
  for (const code of ["28P01", "ECONNREFUSED", "CUSTOM_SECRET_CODE"]) {
    const result = await queryDatabase(databaseUrl, () => {
      throw Object.assign(new Error(databaseUrl), {
        name: "secret-name",
        code,
      });
    });
    assert.equal(result.status, "error");
    assert.ok(
      ["authentication", "connection", "database"].includes(result.errorKind),
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /secret-name|CUSTOM_SECRET_CODE|user:secret/,
    );
  }
});

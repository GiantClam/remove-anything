import assert from "node:assert/strict";
import test from "node:test";

import {
  compareDatabaseSchema,
  compareMigrationState,
  DEPLOYMENT_ENV,
  EXPECTED_MIGRATIONS,
  formatReport,
  inspectEnvironment,
  inspectMigrationFiles,
  REQUIRED_ENV,
  runPreflight,
} from "../../scripts/production-preflight.mjs";

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

test("schema and migration comparisons keep manual SQL patches as an explicit release blocker", () => {
  const schema = {
    status: "ok",
    tables: {
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
    },
    indexes: {
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
    },
  };
  assert.deepEqual(compareDatabaseSchema(schema), []);

  const blockers = compareMigrationState(
    {
      status: "ok",
      migrationTrackingTables: ["_prisma_migrations"],
      migrationRows: { _prisma_migrations: [] },
    },
    inspectMigrationFiles(),
  );
  assert.match(blockers.join("\n"), /manual migration state is unverified/);
  assert.doesNotMatch(blockers.join("\n"), /not recorded in the database/);
});

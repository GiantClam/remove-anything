-- Complete the explicit audit deadline used by the bounded retention runner.
-- Backfill legacy rows from their creation time, then apply the same 90-day
-- default to every new row in each task model.
ALTER TABLE "task_data" ADD COLUMN IF NOT EXISTS "audit_expires_at" timestamp(3);
ALTER TABLE "background_removal_tasks" ADD COLUMN IF NOT EXISTS "audit_expires_at" timestamp(3);
UPDATE "task_data"
SET "audit_expires_at" = "created_at" + INTERVAL '90 days'
WHERE "audit_expires_at" IS NULL;
UPDATE "background_removal_tasks"
SET "audit_expires_at" = "created_at" + INTERVAL '90 days'
WHERE "audit_expires_at" IS NULL;
UPDATE "watermark_removal_tasks"
SET "audit_expires_at" = "created_at" + INTERVAL '90 days'
WHERE "audit_expires_at" IS NULL;
UPDATE "object_removal_tasks"
SET "audit_expires_at" = "created_at" + INTERVAL '90 days'
WHERE "audit_expires_at" IS NULL;
ALTER TABLE "task_data" ALTER COLUMN "audit_expires_at" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days');
ALTER TABLE "background_removal_tasks" ALTER COLUMN "audit_expires_at" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days');
ALTER TABLE "watermark_removal_tasks" ALTER COLUMN "audit_expires_at" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days');
ALTER TABLE "object_removal_tasks" ALTER COLUMN "audit_expires_at" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days');
CREATE INDEX IF NOT EXISTS "task_data_audit_expires_at_idx" ON "task_data" ("audit_expires_at");
CREATE INDEX IF NOT EXISTS "background_removal_tasks_audit_expires_at_idx" ON "background_removal_tasks" ("audit_expires_at");

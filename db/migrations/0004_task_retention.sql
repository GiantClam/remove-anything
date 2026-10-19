-- These nullable markers must also be present in all four Prisma task models.
-- checked_at rotates blocked/failed work to the end of bounded batches;
-- cleaned_at is written only after all known artifacts are safely cleaned.
ALTER TABLE "task_data" ADD COLUMN IF NOT EXISTS "retention_checked_at" timestamp(3);
ALTER TABLE "task_data" ADD COLUMN IF NOT EXISTS "retention_cleaned_at" timestamp(3);
ALTER TABLE "background_removal_tasks" ADD COLUMN IF NOT EXISTS "retention_checked_at" timestamp(3);
ALTER TABLE "background_removal_tasks" ADD COLUMN IF NOT EXISTS "retention_cleaned_at" timestamp(3);
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "retention_checked_at" timestamp(3);
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "retention_cleaned_at" timestamp(3);
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "retention_checked_at" timestamp(3);
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "retention_cleaned_at" timestamp(3);
CREATE INDEX IF NOT EXISTS "task_data_retention_idx" ON "task_data" ("retention_cleaned_at", "retention_checked_at", "expires_at");
CREATE INDEX IF NOT EXISTS "background_removal_tasks_retention_idx" ON "background_removal_tasks" ("retention_cleaned_at", "retention_checked_at", "expires_at");
CREATE INDEX IF NOT EXISTS "watermark_removal_tasks_retention_idx" ON "watermark_removal_tasks" ("retention_cleaned_at", "retention_checked_at", "expires_at");
CREATE INDEX IF NOT EXISTS "watermark_removal_tasks_audit_expires_at_idx" ON "watermark_removal_tasks" ("audit_expires_at");
CREATE INDEX IF NOT EXISTS "object_removal_tasks_retention_idx" ON "object_removal_tasks" ("retention_cleaned_at", "retention_checked_at", "expires_at");
CREATE INDEX IF NOT EXISTS "object_removal_tasks_audit_expires_at_idx" ON "object_removal_tasks" ("audit_expires_at");

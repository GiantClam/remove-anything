ALTER TABLE "task_data" ADD COLUMN IF NOT EXISTS "principal_id" text;
ALTER TABLE "task_data" ADD COLUMN IF NOT EXISTS "expires_at" timestamp(3);
ALTER TABLE "task_data" ADD COLUMN IF NOT EXISTS "retry_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "task_data" ADD COLUMN IF NOT EXISTS "idempotency_key" text;

ALTER TABLE "background_removal_tasks" ADD COLUMN IF NOT EXISTS "principal_id" text;
ALTER TABLE "background_removal_tasks" ADD COLUMN IF NOT EXISTS "expires_at" timestamp(3);
ALTER TABLE "background_removal_tasks" ADD COLUMN IF NOT EXISTS "retry_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "background_removal_tasks" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
CREATE INDEX IF NOT EXISTS "background_removal_tasks_principal_created_idx" ON "background_removal_tasks" ("principal_id", "created_at");
CREATE INDEX IF NOT EXISTS "background_removal_tasks_user_created_idx" ON "background_removal_tasks" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "background_removal_tasks_idempotency_idx" ON "background_removal_tasks" ("idempotency_key");

ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "principal_id" text;
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "expires_at" timestamp(3);
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "retry_count" integer NOT NULL DEFAULT 0;

ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "principal_id" text;
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "expires_at" timestamp(3);
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "retry_count" integer NOT NULL DEFAULT 0;

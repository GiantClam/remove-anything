-- High-risk removal authorization and minimal audit retention.
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "authorization_confirmed" boolean NOT NULL DEFAULT false;
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "authorization_policy_version" text;
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "authorization_subject" text;
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "authorization_confirmed_at" timestamp(3);
ALTER TABLE "watermark_removal_tasks" ADD COLUMN IF NOT EXISTS "audit_expires_at" timestamp(3);
CREATE INDEX IF NOT EXISTS "watermark_removal_tasks_idempotency_idx" ON "watermark_removal_tasks" ("idempotency_key");

ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "authorization_confirmed" boolean NOT NULL DEFAULT false;
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "authorization_policy_version" text;
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "authorization_subject" text;
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "authorization_confirmed_at" timestamp(3);
ALTER TABLE "object_removal_tasks" ADD COLUMN IF NOT EXISTS "audit_expires_at" timestamp(3);
CREATE INDEX IF NOT EXISTS "object_removal_tasks_idempotency_idx" ON "object_removal_tasks" ("idempotency_key");

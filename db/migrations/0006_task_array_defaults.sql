-- Existing TaskData rows predate the Prisma list fields.  Keep the
-- application binary compatible by backfilling those arrays before making
-- them non-null with an empty-array default.
ALTER TABLE "task_data"
  ADD COLUMN IF NOT EXISTS "replicate_urls" text[];
ALTER TABLE "task_data"
  ADD COLUMN IF NOT EXISTS "replicate_logs" text[];

UPDATE "task_data"
SET "replicate_urls" = ARRAY[]::text[]
WHERE "replicate_urls" IS NULL;

UPDATE "task_data"
SET "replicate_logs" = ARRAY[]::text[]
WHERE "replicate_logs" IS NULL;

ALTER TABLE "task_data"
  ALTER COLUMN "replicate_urls" SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "replicate_urls" SET NOT NULL,
  ALTER COLUMN "replicate_logs" SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN "replicate_logs" SET NOT NULL;

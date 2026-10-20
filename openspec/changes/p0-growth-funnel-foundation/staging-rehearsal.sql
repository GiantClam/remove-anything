-- STAGING-ONLY REVIEW ARTIFACT for pqrfvwgldarfbcfdxave; NOT a production migration.
-- Historical SQL actually applied on 2026-10-19, in the three recorded transactions below.
-- This file is retained for review in openspec, outside db/migrations and all deploy automation.
-- It starts from the empty legacy staging schema and is not an idempotent deploy script.
-- Section 1 includes a subsequently rejected billing ON DELETE CASCADE FK.
-- Section 3 removes only that rehearsal-added FK. The final staging schema has no billing-to-task FK.
-- Do not use Section 1 alone as a production proposal. Review the evidence document and corrected plan.

-- SECTION 1: 20261019083915 remove_anything_p0_staging_rename_rehearsal
-- Applied SQL SHA256: c3b3394d93cb270e7ffbf0bbd7d356cd6f4a5ea2a0f82608bcdd88621401ebb5
-- STAGING ONLY: project pqrfvwgldarfbcfdxave. No production approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;
LOCK TABLE public.flux_data, public.flux_downloads, public.flux_views, public.background_removal_tasks, public.object_removal_tasks, public.user_billing, public.users IN ACCESS EXCLUSIVE MODE;
DO $preconditions$
DECLARE actual jsonb; row_count bigint; t text;
BEGIN
 IF current_setting('server_version_num')::integer / 10000 <> 17 THEN RAISE EXCEPTION 'staging must run PostgreSQL 17'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(ARRAY['task_data','task_downloads','task_views','batch_tasks','watermark_removal_tasks','task_data_id_seq','task_downloads_id_seq','task_views_id_seq']) x WHERE to_regclass('public.'||x) IS NOT NULL) THEN RAISE EXCEPTION 'unexpected reconciled table or sequence'; END IF;
 SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',udt_name,'nullable',is_nullable,'ordinal',ordinal_position,'default',column_default,'precision',datetime_precision) ORDER BY table_name,ordinal_position) INTO actual FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('background_removal_tasks','flux_data','flux_downloads','flux_views','object_removal_tasks','user_billing');
 IF actual IS DISTINCT FROM '[{"table":"background_removal_tasks","column":"id","type":"int4","nullable":"NO","ordinal":1,"default":"nextval(''background_removal_tasks_id_seq''::regclass)","precision":null},{"table":"background_removal_tasks","column":"user_id","type":"text","nullable":"YES","ordinal":2,"default":null,"precision":null},{"table":"background_removal_tasks","column":"replicate_id","type":"text","nullable":"NO","ordinal":3,"default":null,"precision":null},{"table":"background_removal_tasks","column":"input_image_url","type":"text","nullable":"NO","ordinal":4,"default":null,"precision":null},{"table":"background_removal_tasks","column":"output_image_url","type":"text","nullable":"YES","ordinal":5,"default":null,"precision":null},{"table":"background_removal_tasks","column":"resolution","type":"text","nullable":"YES","ordinal":6,"default":"''1024x1024''::text","precision":null},{"table":"background_removal_tasks","column":"model","type":"text","nullable":"NO","ordinal":7,"default":"''men1scus/birefnet''::text","precision":null},{"table":"background_removal_tasks","column":"task_status","type":"text","nullable":"NO","ordinal":8,"default":"''pending''::text","precision":null},{"table":"background_removal_tasks","column":"execute_start_time","type":"int8","nullable":"YES","ordinal":9,"default":null,"precision":null},{"table":"background_removal_tasks","column":"execute_end_time","type":"int8","nullable":"YES","ordinal":10,"default":null,"precision":null},{"table":"background_removal_tasks","column":"error_msg","type":"text","nullable":"YES","ordinal":11,"default":null,"precision":null},{"table":"background_removal_tasks","column":"download_count","type":"int4","nullable":"NO","ordinal":12,"default":"0","precision":null},{"table":"background_removal_tasks","column":"view_count","type":"int4","nullable":"NO","ordinal":13,"default":"0","precision":null},{"table":"background_removal_tasks","column":"is_public","type":"bool","nullable":"NO","ordinal":14,"default":"true","precision":null},{"table":"background_removal_tasks","column":"created_at","type":"timestamp","nullable":"NO","ordinal":15,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"background_removal_tasks","column":"updated_at","type":"timestamp","nullable":"NO","ordinal":16,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"flux_data","column":"id","type":"int4","nullable":"NO","ordinal":1,"default":"nextval(''flux_data_id_seq''::regclass)","precision":null},{"table":"flux_data","column":"user_id","type":"text","nullable":"NO","ordinal":2,"default":null,"precision":null},{"table":"flux_data","column":"replicate_id","type":"text","nullable":"NO","ordinal":3,"default":null,"precision":null},{"table":"flux_data","column":"input_prompt","type":"text","nullable":"YES","ordinal":4,"default":null,"precision":null},{"table":"flux_data","column":"execute_prompt","type":"text","nullable":"YES","ordinal":5,"default":null,"precision":null},{"table":"flux_data","column":"steps","type":"int4","nullable":"YES","ordinal":6,"default":null,"precision":null},{"table":"flux_data","column":"guidance","type":"int4","nullable":"YES","ordinal":7,"default":null,"precision":null},{"table":"flux_data","column":"interval","type":"int4","nullable":"YES","ordinal":8,"default":null,"precision":null},{"table":"flux_data","column":"input_image_url","type":"text","nullable":"YES","ordinal":9,"default":null,"precision":null},{"table":"flux_data","column":"image_url","type":"text","nullable":"YES","ordinal":10,"default":null,"precision":null},{"table":"flux_data","column":"model","type":"text","nullable":"NO","ordinal":11,"default":null,"precision":null},{"table":"flux_data","column":"execute_start_time","type":"int8","nullable":"YES","ordinal":12,"default":null,"precision":null},{"table":"flux_data","column":"execute_end_time","type":"int8","nullable":"YES","ordinal":13,"default":null,"precision":null},{"table":"flux_data","column":"locale","type":"text","nullable":"YES","ordinal":14,"default":null,"precision":null},{"table":"flux_data","column":"aspect_ratio","type":"text","nullable":"NO","ordinal":15,"default":null,"precision":null},{"table":"flux_data","column":"safety_tolerance","type":"int4","nullable":"YES","ordinal":16,"default":null,"precision":null},{"table":"flux_data","column":"seed","type":"int4","nullable":"YES","ordinal":17,"default":null,"precision":null},{"table":"flux_data","column":"task_status","type":"text","nullable":"NO","ordinal":18,"default":null,"precision":null},{"table":"flux_data","column":"is_private","type":"bool","nullable":"YES","ordinal":19,"default":"false","precision":null},{"table":"flux_data","column":"download_num","type":"int4","nullable":"NO","ordinal":20,"default":"0","precision":null},{"table":"flux_data","column":"views_num","type":"int4","nullable":"NO","ordinal":21,"default":"0","precision":null},{"table":"flux_data","column":"created_at","type":"timestamp","nullable":"NO","ordinal":22,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"flux_data","column":"updated_at","type":"timestamp","nullable":"NO","ordinal":23,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"flux_data","column":"error_msg","type":"text","nullable":"YES","ordinal":24,"default":null,"precision":null},{"table":"flux_data","column":"lora_url","type":"text","nullable":"YES","ordinal":25,"default":null,"precision":null},{"table":"flux_data","column":"lora_name","type":"text","nullable":"YES","ordinal":26,"default":null,"precision":null},{"table":"flux_data","column":"lora_scale","type":"float8","nullable":"YES","ordinal":27,"default":null,"precision":null},{"table":"flux_downloads","column":"id","type":"int4","nullable":"NO","ordinal":1,"default":"nextval(''flux_downloads_id_seq''::regclass)","precision":null},{"table":"flux_downloads","column":"flux_id","type":"int4","nullable":"NO","ordinal":2,"default":null,"precision":null},{"table":"flux_downloads","column":"user_id","type":"text","nullable":"NO","ordinal":3,"default":null,"precision":null},{"table":"flux_downloads","column":"created_at","type":"timestamp","nullable":"NO","ordinal":4,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"flux_downloads","column":"updated_at","type":"timestamp","nullable":"NO","ordinal":5,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"flux_views","column":"id","type":"int4","nullable":"NO","ordinal":1,"default":"nextval(''flux_views_id_seq''::regclass)","precision":null},{"table":"flux_views","column":"flux_id","type":"int4","nullable":"NO","ordinal":2,"default":null,"precision":null},{"table":"flux_views","column":"user_id","type":"text","nullable":"NO","ordinal":3,"default":null,"precision":null},{"table":"flux_views","column":"created_at","type":"timestamp","nullable":"NO","ordinal":4,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"flux_views","column":"updated_at","type":"timestamp","nullable":"NO","ordinal":5,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"object_removal_tasks","column":"id","type":"int4","nullable":"NO","ordinal":1,"default":"nextval(''object_removal_tasks_id_seq''::regclass)","precision":null},{"table":"object_removal_tasks","column":"user_id","type":"text","nullable":"YES","ordinal":2,"default":null,"precision":null},{"table":"object_removal_tasks","column":"runninghub_task_id","type":"text","nullable":"NO","ordinal":3,"default":null,"precision":null},{"table":"object_removal_tasks","column":"input_image_url","type":"text","nullable":"NO","ordinal":4,"default":null,"precision":null},{"table":"object_removal_tasks","column":"input_mask_url","type":"text","nullable":"NO","ordinal":5,"default":null,"precision":null},{"table":"object_removal_tasks","column":"detect_prompt","type":"text","nullable":"YES","ordinal":6,"default":null,"precision":null},{"table":"object_removal_tasks","column":"output_image_url","type":"text","nullable":"YES","ordinal":7,"default":null,"precision":null},{"table":"object_removal_tasks","column":"task_status","type":"text","nullable":"NO","ordinal":8,"default":"''pending''::text","precision":null},{"table":"object_removal_tasks","column":"execute_start_time","type":"int8","nullable":"YES","ordinal":9,"default":null,"precision":null},{"table":"object_removal_tasks","column":"execute_end_time","type":"int8","nullable":"YES","ordinal":10,"default":null,"precision":null},{"table":"object_removal_tasks","column":"error_msg","type":"text","nullable":"YES","ordinal":11,"default":null,"precision":null},{"table":"object_removal_tasks","column":"is_public","type":"bool","nullable":"NO","ordinal":12,"default":"true","precision":null},{"table":"object_removal_tasks","column":"created_at","type":"timestamp","nullable":"NO","ordinal":13,"default":"CURRENT_TIMESTAMP","precision":6},{"table":"object_removal_tasks","column":"updated_at","type":"timestamp","nullable":"NO","ordinal":14,"default":"CURRENT_TIMESTAMP","precision":6},{"table":"user_billing","column":"id","type":"int4","nullable":"NO","ordinal":1,"default":"nextval(''user_billing_id_seq''::regclass)","precision":null},{"table":"user_billing","column":"user_id","type":"text","nullable":"NO","ordinal":2,"default":null,"precision":null},{"table":"user_billing","column":"state","type":"text","nullable":"NO","ordinal":3,"default":null,"precision":null},{"table":"user_billing","column":"amount","type":"int4","nullable":"NO","ordinal":4,"default":null,"precision":null},{"table":"user_billing","column":"type","type":"text","nullable":"NO","ordinal":5,"default":null,"precision":null},{"table":"user_billing","column":"flux_id","type":"int4","nullable":"YES","ordinal":6,"default":null,"precision":null},{"table":"user_billing","column":"description","type":"text","nullable":"YES","ordinal":7,"default":null,"precision":null},{"table":"user_billing","column":"created_at","type":"timestamp","nullable":"NO","ordinal":8,"default":"CURRENT_TIMESTAMP","precision":3},{"table":"user_billing","column":"updated_at","type":"timestamp","nullable":"NO","ordinal":9,"default":"CURRENT_TIMESTAMP","precision":3}]'::jsonb THEN RAISE EXCEPTION 'legacy column shape differs from reviewed production metadata'; END IF;
 SELECT jsonb_agg(jsonb_build_object('table',t.relname,'name',c.conname,'type',c.contype::text,'definition',pg_get_constraintdef(c.oid)) ORDER BY t.relname,c.conname) INTO actual FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname IN ('background_removal_tasks','flux_data','flux_downloads','flux_views','object_removal_tasks','user_billing');
 IF actual IS DISTINCT FROM '[{"table":"background_removal_tasks","name":"background_removal_tasks_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"background_removal_tasks","name":"background_removal_tasks_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE"},{"table":"flux_data","name":"flux_data_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"flux_data","name":"flux_data_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE"},{"table":"flux_downloads","name":"flux_downloads_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"flux_downloads","name":"flux_downloads_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE"},{"table":"flux_views","name":"flux_views_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"flux_views","name":"flux_views_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE"},{"table":"object_removal_tasks","name":"object_removal_tasks_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"object_removal_tasks","name":"object_removal_tasks_runninghub_task_id_key","type":"u","definition":"UNIQUE (runninghub_task_id)"},{"table":"object_removal_tasks","name":"object_removal_tasks_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE"},{"table":"user_billing","name":"user_billing_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"user_billing","name":"user_billing_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE"}]'::jsonb THEN RAISE EXCEPTION 'legacy constraint shape differs from reviewed production metadata'; END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='id' AND udt_name='text' AND is_nullable='NO') THEN RAISE EXCEPTION 'users id precondition failed'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(ARRAY['flux_data_id_seq','flux_downloads_id_seq','flux_views_id_seq']) x WHERE to_regclass('public.'||x) IS NULL) THEN RAISE EXCEPTION 'legacy sequence absent'; END IF;
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
   EXECUTE format('SELECT count(*) FROM public.%I',t) INTO row_count;
   IF row_count <> 0 THEN RAISE EXCEPTION 'staging isolation precondition: nonempty public table'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM auth.users)<>0 OR (SELECT count(*) FROM storage.objects)<>0 THEN RAISE EXCEPTION 'staging auth/storage must be empty'; END IF;
END $preconditions$;
-- REVIEW-ONLY CANDIDATE. NOT A PRODUCTION MIGRATION. Requires release cutover/backup and app-specific preconditions.
ALTER TABLE public.flux_data RENAME TO task_data;
ALTER TABLE public.flux_downloads RENAME TO task_downloads;
ALTER TABLE public.flux_views RENAME TO task_views;
ALTER TABLE public.task_downloads RENAME COLUMN flux_id TO task_id;
ALTER TABLE public.task_views RENAME COLUMN flux_id TO task_id;
ALTER TABLE public.user_billing RENAME COLUMN flux_id TO task_id;
ALTER TABLE public.task_data RENAME CONSTRAINT flux_data_pkey TO task_data_pkey;
ALTER TABLE public.task_data RENAME CONSTRAINT flux_data_user_id_fkey TO task_data_user_id_fkey;
ALTER TABLE public.task_downloads RENAME CONSTRAINT flux_downloads_pkey TO task_downloads_pkey;
ALTER TABLE public.task_downloads RENAME CONSTRAINT flux_downloads_user_id_fkey TO task_downloads_user_id_fkey;
ALTER TABLE public.task_views RENAME CONSTRAINT flux_views_pkey TO task_views_pkey;
ALTER TABLE public.task_views RENAME CONSTRAINT flux_views_user_id_fkey TO task_views_user_id_fkey;
ALTER SEQUENCE public.flux_data_id_seq RENAME TO task_data_id_seq;
ALTER SEQUENCE public.flux_downloads_id_seq RENAME TO task_downloads_id_seq;
ALTER SEQUENCE public.flux_views_id_seq RENAME TO task_views_id_seq;
ALTER TABLE public.task_data ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.task_data ALTER COLUMN replicate_id DROP NOT NULL;
ALTER TABLE public.task_data ALTER COLUMN aspect_ratio DROP NOT NULL;
ALTER TABLE public.task_data ADD COLUMN prompt text;
ALTER TABLE public.task_data ADD COLUMN orientation text;
ALTER TABLE public.task_data ADD COLUMN batch_task_id integer;
ALTER TABLE public.task_data ADD COLUMN batch_index integer;
ALTER TABLE public.task_data ADD COLUMN r2_url text;
ALTER TABLE public.task_data ADD COLUMN runninghub_file_name text;
ALTER TABLE public.task_data ADD COLUMN replicate_status text;
ALTER TABLE public.task_data ADD COLUMN replicate_urls text[];
ALTER TABLE public.task_data ADD COLUMN replicate_logs text[];
ALTER TABLE public.task_data ADD COLUMN replicate_metrics jsonb;
CREATE TABLE public.batch_tasks (
 id serial PRIMARY KEY, user_id text NOT NULL, task_type text NOT NULL, total_images integer NOT NULL,
 completed_images integer NOT NULL DEFAULT 0, failed_images integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'Processing',metadata jsonb,created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at timestamp(3),
 CONSTRAINT batch_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
ALTER TABLE public.task_data ADD CONSTRAINT task_data_batch_task_id_fkey FOREIGN KEY (batch_task_id) REFERENCES public.batch_tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.user_billing ADD CONSTRAINT user_billing_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_data(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
CREATE TABLE public.watermark_removal_tasks (
 id serial PRIMARY KEY, user_id text, runninghub_task_id text NOT NULL, input_zip_url text NOT NULL, output_zip_url text,
 task_status text NOT NULL DEFAULT 'pending', execute_start_time bigint, execute_end_time bigint, error_msg text,
 download_count integer NOT NULL DEFAULT 0, view_count integer NOT NULL DEFAULT 0, is_public boolean NOT NULL DEFAULT true,
 created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp(3) NOT NULL,
 CONSTRAINT watermark_removal_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE UNIQUE INDEX watermark_removal_tasks_runninghub_task_id_key ON public.watermark_removal_tasks(runninghub_task_id);
CREATE INDEX watermark_removal_tasks_user_id_idx ON public.watermark_removal_tasks(user_id);
CREATE INDEX watermark_removal_tasks_task_status_idx ON public.watermark_removal_tasks(task_status);
CREATE INDEX watermark_removal_tasks_created_at_idx ON public.watermark_removal_tasks(created_at);

-- Staging additions: server-only new tables, no browser-role access.
ALTER TABLE public.batch_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watermark_removal_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.batch_tasks, public.watermark_removal_tasks FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.batch_tasks_id_seq, public.watermark_removal_tasks_id_seq FROM PUBLIC, anon, authenticated;

-- Original 0002_task_lifecycle.sql
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


-- Original 0003_authorization_audit.sql
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


-- Original 0004_task_retention.sql
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

DO $postconditions$
BEGIN
 IF to_regclass('public.task_data') IS NULL OR to_regclass('public.flux_data') IS NOT NULL OR to_regclass('public.flux_downloads') IS NOT NULL OR to_regclass('public.flux_views') IS NOT NULL THEN RAISE EXCEPTION 'rename postcondition failed'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('batch_tasks','watermark_removal_tasks') AND c.relrowsecurity)=2 THEN NULL; ELSE RAISE EXCEPTION 'new table RLS missing'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a WHERE n.nspname='public' AND c.relname IN ('batch_tasks','watermark_removal_tasks','batch_tasks_id_seq','watermark_removal_tasks_id_seq') AND a.grantee IN (0,'anon'::regrole::oid,'authenticated'::regrole::oid)) THEN RAISE EXCEPTION 'new table or sequence exposed to client roles'; END IF;
END $postconditions$;
COMMIT;

-- SECTION 2: 20261019084126 remove_anything_p0_staging_idempotency_rehearsal
-- Applied SQL SHA256: 579d88cb51268b12368c91b0741044fd96638cadd592bf6e502490a818a836cf
-- STAGING ONLY: idempotency rehearsal for the three P0 additive patches.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;

-- Original 0002_task_lifecycle.sql
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


-- Original 0003_authorization_audit.sql
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


-- Original 0004_task_retention.sql
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

COMMIT;

-- SECTION 3: 20261019084427 remove_anything_staging_remove_candidate_billing_cascade
-- Review correction: reject the new billing-to-task cascade; preserve financial history semantics.
-- STAGING ONLY: remove the review-only billing cascade; preserve financial history semantics.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public,pg_catalog;
LOCK TABLE public.user_billing,public.task_data IN ACCESS EXCLUSIVE MODE;
DO $preconditions$
BEGIN
 IF (SELECT count(*) FROM public.user_billing)<>0 OR (SELECT count(*) FROM public.task_data)<>0 THEN RAISE EXCEPTION 'staging tables must remain empty'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.user_billing'::regclass AND c.conname='user_billing_task_id_fkey' AND c.contype='f' AND c.confrelid='public.task_data'::regclass AND c.confdeltype='c' AND c.confupdtype='c' AND NOT c.convalidated AND pg_get_constraintdef(c.oid)='FOREIGN KEY (task_id) REFERENCES task_data(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID') THEN RAISE EXCEPTION 'billing FK does not match this rehearsal-added constraint'; END IF;
END $preconditions$;
ALTER TABLE public.user_billing DROP CONSTRAINT user_billing_task_id_fkey;
COMMIT;

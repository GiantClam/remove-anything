-- One-time production baseline reconciliation for the existing Remove
-- Anything PostgreSQL 17 schema. This preserves legacy task IDs and billing
-- references while aligning the physical names with prisma/schema.prisma.
-- It is intentionally guarded by the observed production shape and row
-- counts. Run it only during the reviewed cutover window through Supabase.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;

LOCK TABLE
  public.flux_data,
  public.flux_downloads,
  public.flux_views,
  public.background_removal_tasks,
  public.object_removal_tasks,
  public.user_billing,
  public.users
IN ACCESS EXCLUSIVE MODE;

DO $preconditions$
DECLARE
  table_count integer;
  constraint_count integer;
BEGIN
  IF current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'production baseline requires PostgreSQL 17';
  END IF;

  IF to_regclass('public.task_data') IS NOT NULL
     OR to_regclass('public.task_downloads') IS NOT NULL
     OR to_regclass('public.task_views') IS NOT NULL
     OR to_regclass('public.batch_tasks') IS NOT NULL
     OR to_regclass('public.watermark_removal_tasks') IS NOT NULL
     OR to_regclass('public.processing_queue') IS NOT NULL
     OR to_regclass('public.background_images') IS NOT NULL
     OR to_regclass('public.background_compositions') IS NOT NULL THEN
    RAISE EXCEPTION 'target baseline objects already exist';
  END IF;

  IF to_regclass('public.flux_data') IS NULL
     OR to_regclass('public.flux_downloads') IS NULL
     OR to_regclass('public.flux_views') IS NULL
     OR to_regclass('public.background_removal_tasks') IS NULL
     OR to_regclass('public.object_removal_tasks') IS NULL
     OR to_regclass('public.user_billing') IS NULL
     OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'legacy baseline object missing';
  END IF;

  IF to_regclass('public.flux_data_id_seq') IS NULL
     OR to_regclass('public.flux_downloads_id_seq') IS NULL
     OR to_regclass('public.flux_views_id_seq') IS NULL THEN
    RAISE EXCEPTION 'legacy sequence missing';
  END IF;

  SELECT count(*) INTO table_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN (
      'background_removal_tasks', 'flux_data', 'flux_downloads',
      'flux_views', 'object_removal_tasks', 'user_billing'
    );
  IF table_count <> 76 THEN
    RAISE EXCEPTION 'legacy column count changed: %', table_count;
  END IF;

  SELECT count(*) INTO constraint_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname IN (
      'background_removal_tasks', 'flux_data', 'flux_downloads',
      'flux_views', 'object_removal_tasks', 'user_billing'
    );
  IF constraint_count <> 13 THEN
    RAISE EXCEPTION 'legacy constraint count changed: %', constraint_count;
  END IF;

  IF (SELECT count(*) FROM public.users) <> 344
     OR (SELECT count(*) FROM public.flux_data) <> 253
     OR (SELECT count(*) FROM public.flux_downloads) <> 0
     OR (SELECT count(*) FROM public.flux_views) <> 0
     OR (SELECT count(*) FROM public.background_removal_tasks) <> 252
     OR (SELECT count(*) FROM public.object_removal_tasks) <> 44
     OR (SELECT count(*) FROM public.user_billing) <> 188 THEN
    RAISE EXCEPTION 'locked production row counts changed; recapture and review';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'id' AND data_type = 'text' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'users.id precondition failed';
  END IF;
END $preconditions$;

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
ALTER TABLE public.task_data ADD COLUMN replicate_urls text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.task_data ADD COLUMN replicate_logs text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.task_data ADD COLUMN replicate_metrics jsonb;

ALTER TABLE public.task_data ADD COLUMN principal_id text;
ALTER TABLE public.task_data ADD COLUMN expires_at timestamp(3);
ALTER TABLE public.task_data ADD COLUMN retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.task_data ADD COLUMN idempotency_key text;
ALTER TABLE public.task_data ADD COLUMN retention_checked_at timestamp(3);
ALTER TABLE public.task_data ADD COLUMN retention_cleaned_at timestamp(3);
ALTER TABLE public.task_data ADD COLUMN audit_expires_at timestamp(3);
UPDATE public.task_data
SET audit_expires_at = created_at + INTERVAL '90 days'
WHERE audit_expires_at IS NULL;
ALTER TABLE public.task_data
  ALTER COLUMN audit_expires_at SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days');

CREATE TABLE public.batch_tasks (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  task_type text NOT NULL,
  total_images integer NOT NULL,
  completed_images integer NOT NULL DEFAULT 0,
  failed_images integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Processing',
  metadata jsonb,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp(3),
  CONSTRAINT batch_tasks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);
ALTER TABLE public.task_data
  ADD CONSTRAINT task_data_batch_task_id_fkey
  FOREIGN KEY (batch_task_id) REFERENCES public.batch_tasks(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TABLE public.watermark_removal_tasks (
  id serial PRIMARY KEY,
  user_id text,
  runninghub_task_id text NOT NULL,
  input_zip_url text NOT NULL,
  output_zip_url text,
  task_status text NOT NULL DEFAULT 'pending',
  execute_start_time bigint,
  execute_end_time bigint,
  error_msg text,
  download_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL,
  principal_id text,
  expires_at timestamp(3),
  retry_count integer NOT NULL DEFAULT 0,
  idempotency_key text,
  retention_checked_at timestamp(3),
  retention_cleaned_at timestamp(3),
  authorization_confirmed boolean NOT NULL DEFAULT false,
  authorization_policy_version text,
  authorization_subject text,
  authorization_confirmed_at timestamp(3),
  audit_expires_at timestamp(3) DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
  CONSTRAINT watermark_removal_tasks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE UNIQUE INDEX watermark_removal_tasks_runninghub_task_id_key
  ON public.watermark_removal_tasks(runninghub_task_id);

ALTER TABLE public.object_removal_tasks
  ADD COLUMN principal_id text,
  ADD COLUMN expires_at timestamp(3),
  ADD COLUMN retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN idempotency_key text,
  ADD COLUMN retention_checked_at timestamp(3),
  ADD COLUMN retention_cleaned_at timestamp(3),
  ADD COLUMN authorization_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN authorization_policy_version text,
  ADD COLUMN authorization_subject text,
  ADD COLUMN authorization_confirmed_at timestamp(3),
  ADD COLUMN audit_expires_at timestamp(3) DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days');
UPDATE public.object_removal_tasks
SET audit_expires_at = created_at + INTERVAL '90 days'
WHERE audit_expires_at IS NULL;

ALTER TABLE public.background_removal_tasks
  ADD COLUMN principal_id text,
  ADD COLUMN expires_at timestamp(3),
  ADD COLUMN retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN idempotency_key text,
  ADD COLUMN retention_checked_at timestamp(3),
  ADD COLUMN retention_cleaned_at timestamp(3),
  ADD COLUMN audit_expires_at timestamp(3) DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days');
UPDATE public.background_removal_tasks
SET audit_expires_at = created_at + INTERVAL '90 days'
WHERE audit_expires_at IS NULL;

CREATE INDEX background_removal_tasks_principal_created_idx
  ON public.background_removal_tasks(principal_id, created_at);
CREATE INDEX IF NOT EXISTS background_removal_tasks_user_id_idx
  ON public.background_removal_tasks(user_id);
CREATE INDEX IF NOT EXISTS background_removal_tasks_task_status_idx
  ON public.background_removal_tasks(task_status);
CREATE INDEX IF NOT EXISTS background_removal_tasks_created_at_idx
  ON public.background_removal_tasks(created_at);
CREATE INDEX background_removal_tasks_user_created_idx
  ON public.background_removal_tasks(user_id, created_at);
CREATE INDEX background_removal_tasks_idempotency_idx
  ON public.background_removal_tasks(idempotency_key);
CREATE INDEX background_removal_tasks_retention_idx
  ON public.background_removal_tasks(retention_cleaned_at, retention_checked_at, expires_at);
CREATE INDEX background_removal_tasks_audit_expires_at_idx
  ON public.background_removal_tasks(audit_expires_at);
CREATE INDEX object_removal_tasks_idempotency_idx
  ON public.object_removal_tasks(idempotency_key);
CREATE INDEX object_removal_tasks_retention_idx
  ON public.object_removal_tasks(retention_cleaned_at, retention_checked_at, expires_at);
CREATE INDEX object_removal_tasks_audit_expires_at_idx
  ON public.object_removal_tasks(audit_expires_at);
CREATE INDEX task_data_retention_idx
  ON public.task_data(retention_cleaned_at, retention_checked_at, expires_at);
CREATE INDEX task_data_audit_expires_at_idx
  ON public.task_data(audit_expires_at);
CREATE INDEX watermark_removal_tasks_idempotency_idx
  ON public.watermark_removal_tasks(idempotency_key);
CREATE INDEX watermark_removal_tasks_user_id_idx
  ON public.watermark_removal_tasks(user_id);
CREATE INDEX watermark_removal_tasks_task_status_idx
  ON public.watermark_removal_tasks(task_status);
CREATE INDEX watermark_removal_tasks_created_at_idx
  ON public.watermark_removal_tasks(created_at);
CREATE INDEX watermark_removal_tasks_retention_idx
  ON public.watermark_removal_tasks(retention_cleaned_at, retention_checked_at, expires_at);
CREATE INDEX watermark_removal_tasks_audit_expires_at_idx
  ON public.watermark_removal_tasks(audit_expires_at);

CREATE TABLE public.processing_queue (
  id serial PRIMARY KEY,
  task_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX processing_queue_status_scheduled_at_idx
  ON public.processing_queue(status, scheduled_at);

CREATE TABLE public.background_images (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  type text NOT NULL,
  category text,
  image_url text NOT NULL,
  thumbnail_url text,
  file_size integer,
  width integer,
  height integer,
  color text,
  gradient jsonb,
  tags text[] NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  usage_count integer NOT NULL DEFAULT 0,
  download_count integer NOT NULL DEFAULT 0,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX background_images_type_idx ON public.background_images(type);
CREATE INDEX background_images_category_idx ON public.background_images(category);
CREATE INDEX background_images_is_public_idx ON public.background_images(is_public);
CREATE INDEX background_images_is_default_idx ON public.background_images(is_default);
CREATE INDEX background_images_sort_order_idx ON public.background_images(sort_order);

CREATE TABLE public.background_compositions (
  id serial PRIMARY KEY,
  user_id text,
  foreground_image_url text NOT NULL,
  background_image_id integer,
  background_type text NOT NULL,
  background_data jsonb NOT NULL,
  composition_params jsonb NOT NULL,
  result_image_url text,
  result_image_size integer,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  download_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp(3),
  CONSTRAINT background_compositions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT background_compositions_background_image_id_fkey
    FOREIGN KEY (background_image_id) REFERENCES public.background_images(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX background_compositions_user_id_idx
  ON public.background_compositions(user_id);
CREATE INDEX background_compositions_status_idx
  ON public.background_compositions(status);
CREATE INDEX background_compositions_created_at_idx
  ON public.background_compositions(created_at);

ALTER TABLE public.batch_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watermark_removal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_compositions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.batch_tasks, public.watermark_removal_tasks,
  public.processing_queue, public.background_images, public.background_compositions
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.batch_tasks_id_seq,
  public.watermark_removal_tasks_id_seq, public.processing_queue_id_seq,
  public.background_images_id_seq, public.background_compositions_id_seq
  FROM PUBLIC, anon, authenticated;

DO $postconditions$
BEGIN
  IF to_regclass('public.task_data') IS NULL
     OR to_regclass('public.flux_data') IS NOT NULL
     OR to_regclass('public.task_downloads') IS NULL
     OR to_regclass('public.flux_downloads') IS NOT NULL
     OR to_regclass('public.task_views') IS NULL
     OR to_regclass('public.flux_views') IS NOT NULL
     OR to_regclass('public.batch_tasks') IS NULL
     OR to_regclass('public.watermark_removal_tasks') IS NULL
     OR to_regclass('public.processing_queue') IS NULL
     OR to_regclass('public.background_images') IS NULL
     OR to_regclass('public.background_compositions') IS NULL THEN
    RAISE EXCEPTION 'production baseline rename postcondition failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.task_data WHERE replicate_urls IS NULL OR replicate_logs IS NULL) THEN
    RAISE EXCEPTION 'TaskData array backfill postcondition failed';
  END IF;
  IF (SELECT count(*) FROM public.users) <> 344
     OR (SELECT count(*) FROM public.task_data) <> 253
     OR (SELECT count(*) FROM public.task_downloads) <> 0
     OR (SELECT count(*) FROM public.task_views) <> 0
     OR (SELECT count(*) FROM public.background_removal_tasks) <> 252
     OR (SELECT count(*) FROM public.object_removal_tasks) <> 44
     OR (SELECT count(*) FROM public.user_billing) <> 188 THEN
    RAISE EXCEPTION 'production baseline row preservation postcondition failed';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('batch_tasks', 'watermark_removal_tasks', 'processing_queue', 'background_images', 'background_compositions')
        AND c.relrowsecurity) <> 5 THEN
    RAISE EXCEPTION 'server-only RLS postcondition failed';
  END IF;
END $postconditions$;

COMMIT;

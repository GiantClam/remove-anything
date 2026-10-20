-- Server-only durable analytics facts. Client behavior remains in GA4.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  event_id text PRIMARY KEY,
  name text NOT NULL,
  task_id text,
  order_id text,
  user_id text,
  tool_slug text,
  landing_page text,
  locale text,
  file_type text,
  file_size_bucket text,
  is_authenticated boolean,
  plan text,
  credits_before integer,
  credits_after integer,
  experiment_id text,
  payload jsonb NOT NULL,
  occurred_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_at_idx
  ON public.analytics_events(occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_name_occurred_at_idx
  ON public.analytics_events(name, occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_tool_occurred_at_idx
  ON public.analytics_events(tool_slug, occurred_at);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated;

COMMIT;

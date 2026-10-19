#!/usr/bin/env node
/**
 * Generate credential-free Supabase MCP execute_sql payloads for the one
 * authorized staging branch. This script does not connect to any database.
 * Run preflight, transaction, postcheck separately and compare their metadata.
 * Every fixture write is inside the transaction terminated by ROLLBACK.
 * All fixture IDs are explicit: PostgreSQL sequence allocation is not tested.
 */
import { pathToFileURL } from "node:url";

export const STAGING_PROJECT_REF = "pqrfvwgldarfbcfdxave";
export const FIXTURE_PREFIX = "staging-compat-20261019-";
const TABLES = [
  "users",
  "task_data",
  "task_downloads",
  "task_views",
  "user_billing",
];
const SEQUENCE_TABLES = TABLES.filter((name) => name !== "users");
const USER_A = FIXTURE_PREFIX + "a";
const USER_B = FIXTURE_PREFIX + "b";
const ID_A = 2000000101;
const ID_B = 2000000102;
const ID_GUEST = 2000000103;
const QUOTE = (value) => "'" + String(value).replaceAll("'", "''") + "'";

export const ASSERTIONS = [
  "postgres17_and_empty_app_tables",
  "no_user_triggers_or_rules",
  "no_billing_to_task_cascade",
  "serial_sequence_ownership",
  "historical_ids_and_billing_values",
  "download_and_view_relationships",
  "per_user_task_and_billing_filters",
  "anonymous_nullable_task_insert",
  "legacy_null_array_columns",
  "array_json_bigint_float_timestamp_roundtrip",
  "p0_default_values",
  "fixture_only_status_and_counter_updates",
  "billing_history_survives_task_delete",
  "sequence_state_unchanged_inside_transaction",
  "all_fixtures_absent_after_rollback",
];

function sequenceStateSql() {
  return (
    "jsonb_build_object(" +
    SEQUENCE_TABLES.map((table) => {
      const seq = table + "_id_seq";
      return (
        QUOTE(seq) +
        ",(SELECT jsonb_build_object('last_value',last_value,'is_called',is_called) FROM public." +
        seq +
        ")"
      );
    }).join(",") +
    ")"
  );
}

function tableCountsSql() {
  return (
    "jsonb_build_object(" +
    TABLES.map(
      (table) => QUOTE(table) + ",(SELECT count(*) FROM public." + table + ")",
    ).join(",") +
    ")"
  );
}

function fixtureCountsSql() {
  return `jsonb_build_object(
    'users',(SELECT count(*) FROM public.users WHERE id IN (${QUOTE(USER_A)},${QUOTE(USER_B)})),
    'tasks',(SELECT count(*) FROM public.task_data WHERE id IN (${ID_A},${ID_B},${ID_GUEST})),
    'downloads',(SELECT count(*) FROM public.task_downloads WHERE id IN (2000001101,2000001102)),
    'views',(SELECT count(*) FROM public.task_views WHERE id IN (2000002101,2000002102)),
    'billings',(SELECT count(*) FROM public.user_billing WHERE id IN (2000003101,2000003102))
  )`;
}

function snapshotSql(phase, includeAssertions = false) {
  return `SELECT jsonb_build_object(
    'phase',${QUOTE(phase)},
    'server_version',current_setting('server_version'),
    'table_counts',${tableCountsSql()},
    'fixture_counts',${fixtureCountsSql()},
    'sequences',${sequenceStateSql()},
    'sequence_ownership',(SELECT jsonb_object_agg(t,pg_get_serial_sequence('public.'||t,'id') ORDER BY t)
      FROM unnest(ARRAY['task_data','task_downloads','task_views','user_billing']) t),
    'schema_fingerprint',(SELECT md5(string_agg(
      table_name||':'||column_name||':'||udt_name||':'||is_nullable||':'||COALESCE(column_default,'')||':'||COALESCE(datetime_precision::text,''),
      '|' ORDER BY table_name,ordinal_position))
      FROM information_schema.columns WHERE table_schema='public'
      AND table_name IN ('users','task_data','task_downloads','task_views','user_billing')),
    'billing_task_fk_count',(SELECT count(*) FROM pg_constraint WHERE conrelid='public.user_billing'::regclass
      AND contype='f' AND confrelid='public.task_data'::regclass)
    ${includeAssertions ? ",'assertions_completed'," + QUOTE(JSON.stringify(ASSERTIONS)) + "::jsonb" : ""}
  ) AS staging_compatibility;`;
}

export function buildTransactionSql() {
  return `-- STAGING ONLY: pqrfvwgldarfbcfdxave. Synthetic compatibility fixtures; never production.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='30s';
SET LOCAL search_path=public,pg_catalog;
LOCK TABLE public.users,public.task_data,public.task_downloads,public.task_views,public.user_billing IN ACCESS EXCLUSIVE MODE;
DO $compatibility$
DECLARE
  sequence_before jsonb;
  sequence_after jsonb;
  t text;
  n bigint;
  a record;
  modern record;
BEGIN
  IF current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'expected PostgreSQL 17';
  END IF;
  FOREACH t IN ARRAY ARRAY['users','task_data','task_downloads','task_views','user_billing'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
    IF n<>0 THEN RAISE EXCEPTION 'isolated staging compatibility tables must be empty'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid IN
    ('public.users'::regclass,'public.task_data'::regclass,'public.task_downloads'::regclass,
     'public.task_views'::regclass,'public.user_billing'::regclass) AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'unexpected user trigger: stop before synthetic writes';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class IN
    ('public.users'::regclass,'public.task_data'::regclass,'public.task_downloads'::regclass,
     'public.task_views'::regclass,'public.user_billing'::regclass) AND rulename<>'_RETURN') THEN
    RAISE EXCEPTION 'unexpected rewrite rule: stop before synthetic writes';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.user_billing'::regclass
    AND contype='f' AND confrelid='public.task_data'::regclass) THEN
    RAISE EXCEPTION 'billing-to-task FK must remain absent';
  END IF;
  FOREACH t IN ARRAY ARRAY['task_data','task_downloads','task_views','user_billing'] LOOP
    IF pg_get_serial_sequence('public.'||t,'id') IS DISTINCT FROM 'public.'||t||'_id_seq' THEN
      RAISE EXCEPTION 'renamed sequence ownership mismatch';
    END IF;
  END LOOP;
  SELECT ${sequenceStateSql()} INTO sequence_before;

  INSERT INTO public.users(id,name,email,updated_at) VALUES
    (${QUOTE(USER_A)},'Synthetic compatibility A','staging-compat-a@example.invalid','2020-01-02 03:04:05.123'),
    (${QUOTE(USER_B)},'Synthetic compatibility B','staging-compat-b@example.invalid','2020-01-02 03:04:05.123');

  -- Historical shape: explicit Int32 IDs; baseline-only fields populated;
  -- newly added optional columns, including text arrays, intentionally NULL.
  INSERT INTO public.task_data(
    id,user_id,replicate_id,input_prompt,model,task_status,aspect_ratio,image_url,
    execute_start_time,execute_end_time,lora_scale,created_at,updated_at
  ) VALUES
    (${ID_A},${QUOTE(USER_A)},'synthetic-history-a','synthetic input A','synthetic-model','Succeeded','1:1',
     'https://synthetic.invalid/history-a.png',1577934245123,1577934246123,0.25,
     '2020-01-02 03:04:05.123','2020-01-02 03:04:06.123'),
    (${ID_B},${QUOTE(USER_B)},'synthetic-history-b','synthetic input B','synthetic-model','Succeeded','1:1',
     'https://synthetic.invalid/history-b.png',1577934245123,1577934246123,0.5,
     '2020-01-02 03:04:05.123','2020-01-02 03:04:06.123');

  -- Modern shape: nullable owner/provider/aspect, explicit arrays and JSON,
  -- BigInt sentinel larger than JavaScript's exact-number range.
  INSERT INTO public.task_data(
    id,user_id,replicate_id,aspect_ratio,model,task_status,principal_id,prompt,
    orientation,execute_start_time,replicate_urls,replicate_logs,replicate_metrics
  ) VALUES (
    ${ID_GUEST},NULL,NULL,NULL,'synthetic-model','Processing','synthetic-guest-principal','synthetic prompt',
    'landscape',9007199254740993,ARRAY['https://synthetic.invalid/modern.mp4'],ARRAY['synthetic log'],
    '{"fixture":true,"duration":1.25}'::jsonb
  );

  INSERT INTO public.task_downloads(id,task_id,user_id) VALUES
    (2000001101,${ID_A},${QUOTE(USER_A)}),(2000001102,${ID_B},${QUOTE(USER_B)});
  INSERT INTO public.task_views(id,task_id,user_id) VALUES
    (2000002101,${ID_A},${QUOTE(USER_A)}),(2000002102,${ID_B},${QUOTE(USER_B)});
  INSERT INTO public.user_billing(id,user_id,state,amount,type,task_id,description) VALUES
    (2000003101,${QUOTE(USER_A)},'expense',6,'synthetic',${ID_A},'synthetic historical charge A'),
    (2000003102,${QUOTE(USER_B)},'expense',3,'synthetic',${ID_B},'synthetic historical charge B');

  SELECT t.id,t.user_id,t.execute_start_time,t.execute_end_time,t.created_at,t.lora_scale,
    t.replicate_urls,t.replicate_logs,t.replicate_metrics,t.principal_id,t.expires_at,t.retry_count,
    t.idempotency_key,t.retention_checked_at,t.retention_cleaned_at,b.task_id,b.amount,b.state,b.type
    INTO a FROM public.task_data t JOIN public.user_billing b ON b.task_id=t.id
    WHERE t.id=${ID_A} AND b.user_id=${QUOTE(USER_A)};
  IF a.id IS DISTINCT FROM ${ID_A} OR a.task_id IS DISTINCT FROM ${ID_A}
    OR a.amount IS DISTINCT FROM 6 OR a.state IS DISTINCT FROM 'expense' OR a.type IS DISTINCT FROM 'synthetic'
    OR a.user_id IS DISTINCT FROM ${QUOTE(USER_A)} THEN
    RAISE EXCEPTION 'historical task ID or billing linkage/value changed';
  END IF;
  IF a.replicate_urls IS NOT NULL OR a.replicate_logs IS NOT NULL OR a.replicate_metrics IS NOT NULL
    OR a.principal_id IS NOT NULL OR a.expires_at IS NOT NULL OR a.retry_count<>0
    OR a.idempotency_key IS NOT NULL OR a.retention_checked_at IS NOT NULL OR a.retention_cleaned_at IS NOT NULL THEN
    RAISE EXCEPTION 'historical NULL/default representation changed';
  END IF;
  IF pg_typeof(a.id)::text<>'integer' OR pg_typeof(a.execute_start_time)::text<>'bigint'
    OR a.execute_start_time<>1577934245123 OR a.execute_end_time<>1577934246123
    OR pg_typeof(a.created_at)::text<>'timestamp without time zone'
    OR a.created_at<>'2020-01-02 03:04:05.123'::timestamp(3)
    OR pg_typeof(a.lora_scale)::text<>'double precision' OR a.lora_scale<>0.25 THEN
    RAISE EXCEPTION 'baseline scalar type/value roundtrip failed';
  END IF;

  IF (SELECT count(*) FROM public.task_downloads d JOIN public.task_data t ON t.id=d.task_id
      WHERE d.user_id=t.user_id)<>2
    OR (SELECT count(*) FROM public.task_views v JOIN public.task_data t ON t.id=v.task_id
      WHERE v.user_id=t.user_id)<>2 THEN
    RAISE EXCEPTION 'download/view task linkage failed';
  END IF;
  IF (SELECT count(*) FROM public.task_data WHERE user_id=${QUOTE(USER_A)})<>1
    OR (SELECT count(*) FROM public.task_data WHERE user_id=${QUOTE(USER_B)})<>1
    OR EXISTS(SELECT 1 FROM public.task_data WHERE id=${ID_A} AND user_id=${QUOTE(USER_B)})
    OR (SELECT count(*) FROM public.user_billing WHERE user_id=${QUOTE(USER_A)})<>1
    OR (SELECT count(*) FROM public.user_billing WHERE user_id=${QUOTE(USER_B)})<>1
    OR EXISTS(SELECT 1 FROM public.user_billing WHERE task_id=${ID_A} AND user_id=${QUOTE(USER_B)})
    OR (SELECT count(*) FROM public.task_data WHERE principal_id='synthetic-guest-principal' AND user_id IS NULL)<>1 THEN
    RAISE EXCEPTION 'server-side ownership predicate compatibility failed';
  END IF;

  SELECT user_id,replicate_id,aspect_ratio,execute_start_time,replicate_urls,replicate_logs,replicate_metrics,retry_count
    INTO modern FROM public.task_data WHERE id=${ID_GUEST};
  IF modern.user_id IS NOT NULL OR modern.replicate_id IS NOT NULL OR modern.aspect_ratio IS NOT NULL
    OR modern.retry_count<>0 OR modern.execute_start_time<>9007199254740993
    OR pg_typeof(modern.replicate_urls)::text<>'text[]'
    OR modern.replicate_urls<>ARRAY['https://synthetic.invalid/modern.mp4']
    OR modern.replicate_logs<>ARRAY['synthetic log']
    OR pg_typeof(modern.replicate_metrics)::text<>'jsonb'
    OR modern.replicate_metrics<>'{"fixture":true,"duration":1.25}'::jsonb THEN
    RAISE EXCEPTION 'modern nullability/array/JSON/BigInt roundtrip failed';
  END IF;

  UPDATE public.task_data SET task_status='Succeeded',retry_count=retry_count+1,
    replicate_status='completed',image_url='https://synthetic.invalid/modern.mp4'
    WHERE id=${ID_GUEST} AND principal_id='synthetic-guest-principal';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR (SELECT retry_count FROM public.task_data WHERE id=${ID_GUEST})<>1
    OR (SELECT task_status FROM public.task_data WHERE id=${ID_GUEST})<>'Succeeded' THEN
    RAISE EXCEPTION 'fixture task status update failed';
  END IF;
  UPDATE public.task_data SET download_num=download_num+1,views_num=views_num+1
    WHERE id=${ID_A} AND user_id=${QUOTE(USER_A)};
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR (SELECT download_num FROM public.task_data WHERE id=${ID_A})<>1
    OR (SELECT views_num FROM public.task_data WHERE id=${ID_A})<>1 THEN
    RAISE EXCEPTION 'fixture task counter update failed';
  END IF;

  -- Delete only our task fixture. Production's absent billing task FK must
  -- continue to preserve the synthetic financial-history row and its task ID.
  DELETE FROM public.task_data WHERE id=${ID_A} AND user_id=${QUOTE(USER_A)};
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 OR NOT EXISTS(SELECT 1 FROM public.user_billing WHERE id=2000003101
    AND user_id=${QUOTE(USER_A)} AND task_id=${ID_A} AND amount=6) THEN
    RAISE EXCEPTION 'billing history was deleted or rewritten with task fixture';
  END IF;

  SELECT ${sequenceStateSql()} INTO sequence_after;
  IF sequence_before IS DISTINCT FROM sequence_after THEN
    RAISE EXCEPTION 'explicit-ID fixture unexpectedly changed sequence state';
  END IF;
END $compatibility$;
ROLLBACK;
${snapshotSql("transaction_rolled_back", true)}
`;
}

export function buildPayload({ projectRef, phase }) {
  if (projectRef !== STAGING_PROJECT_REF) {
    throw new Error(
      "Refusing target: this verifier permits only the authorized staging project",
    );
  }
  if (!["preflight", "transaction", "postcheck"].includes(phase)) {
    throw new Error("Choose --phase preflight, transaction, or postcheck");
  }
  const query =
    phase === "transaction" ? buildTransactionSql() : snapshotSql(phase);
  if (
    phase === "transaction" &&
    (!query.includes("\nROLLBACK;\n") ||
      /\bCOMMIT\s*;/i.test(query) ||
      /\b(?:nextval|setval)\s*\(/i.test(query) ||
      /\b(?:CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\s/i.test(query))
  ) {
    throw new Error("Internal transaction safety invariant failed");
  }
  return { project_id: STAGING_PROJECT_REF, query };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: node scripts/verify-staging-compatibility.mjs --project-ref " +
        STAGING_PROJECT_REF +
        " --phase preflight|transaction|postcheck\n" +
        "Outputs a Supabase execute_sql JSON payload; does not connect or read env files.",
    );
    return;
  }
  const known = new Set(["--project-ref", "--phase"]);
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!known.has(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error("Invalid arguments; use --help");
    }
    values[args[i]] = args[i + 1];
  }
  console.log(
    JSON.stringify(
      buildPayload({
        projectRef: values["--project-ref"],
        phase: values["--phase"],
      }),
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

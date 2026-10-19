# Remaining Remove Anything baseline review

Reviewed: 2026-10-19. Scope: repository source, the exact rollback commit `36d7e86460f837f7369f0caab6b0d62b65a8ce2c`, and existing local metadata. This review made no database connection, production query, production change, Git index change, or application-code edit. The SQL below is a review proposal, not an applied migration.

## Evidence and limits

- Current schema: `prisma/schema.prisma`, SHA-256 `1f90a3e585b3d93227d1559f96dde47befba5f947148aa1e7cfee64d0d932762` at review time.
- Rollback schema exported with read-only `git show 36d7e86460f837f7369f0caab6b0d62b65a8ce2c:prisma/schema.prisma` to `/tmp/remove-anything-remaining-baseline-review/prisma/schema.prisma`, SHA-256 `ba080911e9351f1b4c1431c1e627e1c0393878da21b7f860707ed8ba9b170b42`.
- `/tmp/remove-anything-production-schema-metadata.json`, SHA-256 `33614483aa8e428cd7fa98a9b9c345ff668c555d682b251f579c868d111710dd`: 76 columns across only six existing tables (`flux_data`, `flux_downloads`, `flux_views`, `background_removal_tasks`, `object_removal_tasks`, `user_billing`), 14 indexes, 13 constraints, and five sequence names. This file does not inventory all public tables; omission from this file alone does not prove another table is absent.
- The existing `baseline-compatibility-plan.md` records the broader allowlist audit and absent tables. Its local catalog is `/tmp/remove-anything-task-compatibility-catalog.json`, observed `2026-10-19T08:34:17.863Z`, SHA-256 `872bf66c62f665ea69eccd08ca4f4c42e8b44c1385073c85e2f91b664dae0516`. This review re-read the saved catalog; it did not refresh production state.
- `staging-migration-evidence.md` records the already-rehearsed rename, additive task baseline, and P0 patches. `staging-compatibility-evidence.md` records the separate SQL-only historical-fixture checks and rollback cleanup. Neither document records creation or Prisma acceptance of the three remaining tables proposed below.

The remaining-table conclusion is therefore tied to the recorded production baseline. A later executor must recheck only the named objects against that reviewed baseline before applying any DDL. This review does not assert that unrelated shared-schema tables such as `media`, auth, Stripe, newsletter, or payment tables are absent, correct, or candidates for creation.

## Baseline inventory for both application versions

The scalar counts below exclude Prisma relation fields. `ProcessingQueue`, `BackgroundImage`, `BackgroundComposition`, and `BatchTask` model blocks are byte-for-byte identical in the current and rollback schemas. The composition/image API routes, Prisma queue adapter, and cron route are also identical at the rollback SHA.

| Physical table or object                           | Recorded production baseline                                            | Existing staging work                                                                                                 | Remaining action                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `task_data`                                        | Only legacy `flux_data` exists, with 27 columns                         | Rename preserving table/sequence identity, ten baseline additions, three nullable changes, and P0 additions rehearsed | Production remains unchanged; review and apply the scoped candidate separately                                      |
| `task_downloads`, `task_views`                     | Only `flux_downloads`, `flux_views` exist                               | Identity-preserving rename and `flux_id` to `task_id` rehearsed                                                       | Do not create empty replacements; retain historical IDs/references                                                  |
| `user_billing.task_id`                             | Named `flux_id`                                                         | Column rename rehearsed; candidate task cascade was explicitly removed                                                | Preserve financial history and no billing-to-task physical cascade                                                  |
| `batch_tasks`                                      | Recorded absent; ten scalar columns in both schemas                     | Created in the existing staging baseline rehearsal                                                                    | No additional batch DDL in this review; no direct production `batchTask` caller found in searched application paths |
| `watermark_removal_tasks`                          | Recorded absent; rollback expects 14 scalar columns, current expects 25 | Base table plus 11 P0 columns rehearsed                                                                               | No duplicate creation in this review; task/history/download/cron paths require it                                   |
| `processing_queue`                                 | Recorded absent; nine scalar columns in both schemas                    | Not created by the recorded rehearsal                                                                                 | Three-table additive proposal below                                                                                 |
| `background_images`                                | Recorded absent; 20 scalar columns in both schemas                      | Not created by the recorded rehearsal                                                                                 | Three-table additive proposal below                                                                                 |
| `background_compositions`                          | Recorded absent; 16 scalar columns in both schemas                      | Not created by the recorded rehearsal                                                                                 | Three-table additive proposal below                                                                                 |
| `background_removal_tasks`, `object_removal_tasks` | Existing base columns match the rollback's scalar column names          | P0 additions rehearsed                                                                                                | These need additive P0 changes, not replacement tables; existing defaults/precision must remain under review        |

`flux_data` lacks ten scalar columns already expected by the rollback binary: `prompt`, `orientation`, `batch_task_id`, `batch_index`, `r2_url`, `runninghub_file_name`, `replicate_status`, `replicate_urls`, `replicate_logs`, `replicate_metrics`. Current P0 adds six more. The legacy `user_id`, `replicate_id`, and `aspect_ratio` are not nullable while both application schemas permit null. These are covered by the separate baseline reconciliation; the three CREATE statements below do not repair them.

`batch_tasks` and watermark tables are part of the deployed Prisma baseline even though they are absent in the recorded database. The lack of a direct batch caller does not justify discarding that modeled table or its `task_data.batch_task_id` relationship. It also does not prove that ordinary scalar-only TaskData reads query `batch_tasks`.

## Actual call paths

Line references are to the repository source snapshot inspected during this review; the identical rollback files retain the same line numbers unless an alternate rollback line is given. Separate follow-up changes to route authorization can supersede the findings below and require their own regression evidence; this review did not make those changes.

| Object                                         | Concrete source path                                                                                                                       | Schema dependency and consequence                                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `background_compositions`                      | `app/api/background-composition/route.ts:31`, `:78`, `:100`, `:141`                                                                        | POST creates a task; PUT reads then updates/upload results; authenticated GET lists history with `include: { backgroundImage: true }`. Both the composition row's scalar columns and the image relation target are required. Missing tables produce database errors, not an empty successful history. |
| `background_images`                            | `app/api/background-images/route.ts:34`, `:44`, `:120`, `:169`; `scripts/seed-background-images.ts:25`, `:78`                              | GET lists/counts by type/category/public status and sorts by default/order/time. Both file-upload and solid/gradient POST paths create full Prisma rows. The seed script also writes this table; it was not executed by this review.                                                                  |
| `processing_queue`                             | `app/api/sora2-video-watermark-removal-url/route.ts:102`, `:116`, `:192` (rollback `:101`, `:115`, `:191`)                                 | Non-R2 URLs, transform/prewarm failures, and later failures enqueue JSON payloads for deferred processing. Queue metadata includes retry/error/schedule fields.                                                                                                                                       |
| `processing_queue`                             | `modules/tasks/adapters/prisma-queue.ts:7`, called by `modules/tasks/sdk.ts:68` (rollback `:67`) and R2/URL entry routes                   | A RunningHub submission failure can enqueue through the shared adapter. `app/api/sora2-video-watermark-removal-r2/route.ts:176` wires that adapter (rollback `:175`).                                                                                                                                 |
| `processing_queue`                             | `app/api/cron/process-queue/route.ts:31`, `:39`, `:48`, `:52`                                                                              | The cron first selects due pending jobs and updates state/retry/backoff. A missing queue table throws before the subsequent background and watermark synchronization loops.                                                                                                                           |
| `background_images`, `background_compositions` | Current-only `lib/task-retention.ts:250-284`                                                                                               | Shared-reference protection counts image/composition URL references before deleting an artifact. Missing tables make this check fail closed. This module does not exist in the rollback SHA.                                                                                                          |
| `watermark_removal_tasks`                      | `db/queries/watermark-removal.ts:53`, `:78`, `:109`, `:132`; `app/api/mine-tasks/route.ts:94`; `app/api/download/route.ts:96`; cron `:183` | CRUD, history, downloads, and status reconciliation require the base watermark table. Rollback has the same paths, with query helper calls at `:36`, `:61`, `:92`, `:115` and download at `:74`.                                                                                                      |

`GET /api/task-queue/status` uses the in-memory `taskQueueManager`, not `processing_queue`; a successful response from that endpoint does not establish the persistent queue table or cron behavior. No API fetch to `/api/background-images` or `/api/background-composition` was found in the searched current components; the server routes and seed are nevertheless concrete database callers. Creating a table does not prove a user-facing editor invokes those routes.

## Smallest remaining additive table proposal

This proposal contains only three Remove Anything tables, their three serial sequences, nine non-primary indexes, and the two modeled composition foreign keys. It adds no shared-schema table, billing constraint, data backfill, provider job, seed image, or compatibility view. The `users(id)` reference must resolve to the reviewed `public.users`, not the unrelated `public."user"` table.

The column definitions follow both exact schema versions: `timestamp(3)` without time zone; JSONB for Json; nullable SQL `TEXT[]` for Prisma's generated `tags` column; `updated_at` has no database default because Prisma supplies `@updatedAt`. A raw SQL fixture must therefore provide `updated_at`. Do not silently add a trigger, change timestamp semantics, or coerce nullable arrays while creating this baseline.

Before execution, prepare a transactional wrapper with explicit schema/owner/role preconditions and lock/statement timeouts. Assert all three tables, their named indexes/constraints, and serial sequence names are absent; assert the referenced users primary key and expected application role. Use plain CREATE so an unexpected preexisting object aborts. Do not use `IF NOT EXISTS` to conceal an incompatible partial baseline. After creation, verify all 45 scalar columns, sequence defaults/ownership, nine index definitions, both FK actions, and server-only ACL/RLS behavior before commit.

```sql
-- REVIEW ONLY. Not executed by this review. Requires the narrow preconditions
-- and transaction wrapper described above, followed by isolated staging tests.
CREATE TABLE public.processing_queue (
  id SERIAL PRIMARY KEY,
  task_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX processing_queue_status_scheduled_at_idx
  ON public.processing_queue (status, scheduled_at);

CREATE TABLE public.background_images (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  category TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  color TEXT,
  gradient JSONB,
  tags TEXT[],
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX background_images_type_idx ON public.background_images (type);
CREATE INDEX background_images_category_idx ON public.background_images (category);
CREATE INDEX background_images_is_public_idx ON public.background_images (is_public);
CREATE INDEX background_images_is_default_idx ON public.background_images (is_default);
CREATE INDEX background_images_sort_order_idx ON public.background_images (sort_order);

CREATE TABLE public.background_compositions (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  foreground_image_url TEXT NOT NULL,
  background_image_id INTEGER,
  background_type TEXT NOT NULL,
  background_data JSONB NOT NULL,
  composition_params JSONB NOT NULL,
  result_image_url TEXT,
  result_image_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  download_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  completed_at TIMESTAMP(3),
  CONSTRAINT background_compositions_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT background_compositions_background_image_id_fkey
    FOREIGN KEY (background_image_id) REFERENCES public.background_images(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX background_compositions_user_id_idx
  ON public.background_compositions (user_id);
CREATE INDEX background_compositions_status_idx
  ON public.background_compositions (status);
CREATE INDEX background_compositions_created_at_idx
  ON public.background_compositions (created_at);

-- Server-only access, consistent with the existing staging baseline boundary.
-- Verify the server role can use these objects before applying this policy.
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_compositions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.processing_queue, public.background_images,
  public.background_compositions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.processing_queue_id_seq,
  public.background_images_id_seq, public.background_compositions_id_seq
  FROM PUBLIC, anon, authenticated;
```

These ACL statements affect only new tables/sequences. They do not secure the HTTP handlers or repair broad grants on existing tables. The two composition FKs apply only to these new records; unlike an added billing FK, they do not retrofit deletion behavior onto financial history. Their exact modeled cascade/set-null behavior still needs explicit acceptance in staging.

## Acceptance still needed before activation

1. Rehearse this three-table proposal on the isolated branch, record its own checksum/result, and verify schema/sequence/ACL metadata. The existing 15 SQL compatibility checks cover task/billing objects; they do not cover these three tables.
2. With isolated credentials and synthetic `.invalid` URLs, exercise both exact Prisma versions against queue create/read/retry updates, image create/filter/list, composition create/history/update, nullable owner/image relations, JSON/array round trips, `@updatedAt`, and the two FK actions. A generated-client build or SQL-only fixture is insufficient for Prisma transport acceptance. Do not call providers or production R2.
3. Verify persistent queue dispatch separately: the shared SDK enqueues `video-watermark-removal` (`modules/tasks/sdk.ts:68`, rollback `:67`), while the cron only dispatches `sora2-video-watermark-removal` (`app/api/cron/process-queue/route.ts:45`) and then marks a row completed (`:48`). This mismatch exists in both versions. Creating `processing_queue` alone can expose this existing logic failure; it is not a migration fix.
4. Review the image/composition HTTP callers before activating working persistence. The composition PUT omits owner filtering for anonymous users via `userId: userId || undefined` (`app/api/background-composition/route.ts:78-82`) and later updates by ID. The image POST's admin check is commented out (`app/api/background-images/route.ts:69-73`) and the multipart path uploads to R2 before insertion (`:98`, `:120`). Both behaviors are present in the exact rollback source. Server-only table ACLs do not prevent these server-mediated actions.
5. Verify current P0 shared-reference protection with missing/unreadable image/composition tables and after the additive baseline. Keep retention execution disabled until its independent authorization, ownership, storage, provider-deletion, and privacy gates pass.

This review leaves the release blocked by the recorded production schema drift, the unrehearsed three-table baseline, exact-Prisma execution evidence, and the independent functional/security gates above. It does not authorize a whole-schema `prisma db push`, shared database reset, branch merge, production migration, or seed script.

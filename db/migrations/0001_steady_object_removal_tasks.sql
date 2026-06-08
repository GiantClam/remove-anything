CREATE TABLE IF NOT EXISTS "object_removal_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"runninghub_task_id" text NOT NULL UNIQUE,
	"input_image_url" text NOT NULL,
	"input_mask_url" text NOT NULL,
	"detect_prompt" text,
	"output_image_url" text,
	"task_status" text DEFAULT 'pending' NOT NULL,
	"execute_start_time" bigint,
	"execute_end_time" bigint,
	"error_msg" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "object_removal_tasks" ADD CONSTRAINT "object_removal_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "object_removal_tasks_user_id_idx" ON "object_removal_tasks" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "object_removal_tasks_task_status_idx" ON "object_removal_tasks" ("task_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "object_removal_tasks_created_at_idx" ON "object_removal_tasks" ("created_at");

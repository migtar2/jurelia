CREATE TABLE IF NOT EXISTS "beta_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "feedback_type" text NOT NULL,
  "description" text,
  "context" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
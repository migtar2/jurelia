-- Migration: Create user_subscriptions table for plan management
-- Phase 03 — JURELIA SaaS Monetization

CREATE TABLE IF NOT EXISTS "user_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "plan" text NOT NULL DEFAULT 'free',
  "status" text NOT NULL DEFAULT 'active',
  "effective_from" timestamp with time zone DEFAULT now() NOT NULL,
  "effective_until" timestamp with time zone,
  "source" text NOT NULL DEFAULT 'default',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for plan resolution queries
CREATE INDEX IF NOT EXISTS "idx_user_subscriptions_user_id" ON "user_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_subscriptions_plan_status" ON "user_subscriptions" ("plan", "status");

-- Migrate existing users: all get FREE as default plan
INSERT INTO "user_subscriptions" ("user_id", "plan", "status", "source")
SELECT "id", 'free', 'active', 'migration'
FROM "users"
ON CONFLICT ("user_id") DO NOTHING;
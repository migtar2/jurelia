-- Migration: Create usage_reservations table for quota enforcement
-- Phase 04 — JURELIA SaaS Monetization

CREATE TABLE IF NOT EXISTS "usage_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "state" text NOT NULL DEFAULT 'reserved',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Composite index for atomic quota checks (user + category + period + state)
CREATE INDEX IF NOT EXISTS "idx_usage_reservations_lookup" ON "usage_reservations" ("user_id", "category", "period_start", "state");
CREATE INDEX IF NOT EXISTS "idx_usage_reservations_user" ON "usage_reservations" ("user_id");
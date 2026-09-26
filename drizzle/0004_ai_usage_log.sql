-- Migration: Create ai_usage_log table for AI cost observability
-- Phase 01 — JURELIA SaaS Monetization

CREATE TABLE IF NOT EXISTS "ai_usage_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "operation_type" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer,
  "cached_input_tokens" integer,
  "output_tokens" integer,
  "reasoning_tokens" integer,
  "total_tokens" integer,
  "cost_usd" text,
  "latency_ms" integer,
  "success" boolean NOT NULL DEFAULT true,
  "error_type" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS "idx_ai_usage_log_user_id" ON "ai_usage_log" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_log_created_at" ON "ai_usage_log" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_log_operation_type" ON "ai_usage_log" ("operation_type");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_log_provider_model" ON "ai_usage_log" ("provider", "model");
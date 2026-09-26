CREATE TABLE IF NOT EXISTS "saved_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "analysis_id" uuid,
  "filename" text NOT NULL,
  "original_type" text,
  "doc_type" text,
  "issue_count" integer DEFAULT 0,
  "argument_count" integer DEFAULT 0,
  "citation_count" integer DEFAULT 0,
  "analysis_snapshot" jsonb,
  "research_snapshot" jsonb,
  "saved_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE cascade;
ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_analysis_id_document_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "document_analyses"("id") ON DELETE set null;
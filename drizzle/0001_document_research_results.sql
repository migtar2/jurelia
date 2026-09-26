CREATE TABLE "document_research_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"issue_text" text NOT NULL,
	"decision_roj" text,
	"decision_ecli" text,
	"organo" text,
	"fecha" text,
	"relationship" text NOT NULL,
	"reason" text,
	"evidence_basis" text NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_research_results" ADD CONSTRAINT "document_research_results_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_research_results" ADD CONSTRAINT "document_research_results_analysis_id_document_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."document_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_research_results" ADD CONSTRAINT "document_research_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
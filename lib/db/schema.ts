import { pgTable, uuid, text, timestamp, date, jsonb, boolean, integer, real, primaryKey, unique } from "drizzle-orm/pg-core";

/* ── Users ── */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

/* ── Saved Decisions ── */
export const savedDecisions = pgTable("saved_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roj: text("roj").notNull(),
  ecli: text("ecli"),
  organo: text("organo").notNull(),
  fecha: date("fecha"),
  titulo: text("titulo"),
  ponente: text("ponente"),
  nRecurso: text("n_recurso"),
  urlPdf: text("url_pdf"),
  resumen: text("resumen"),
  aiSummary: jsonb("ai_summary"),
  // Extra fields for comparison/proposition items
  type: text("type").default("decision").notNull(), // decision | comparison | proposition
  comparisonData: jsonb("comparison_data"),
  propositionData: jsonb("proposition_data"),
  savedAt: timestamp("saved_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("saved_decisions_user_roj_unique").on(t.userId, t.roj),
]);

/* ── Folders ── */
export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("folders_user_name_unique").on(t.userId, t.name),
]);

/* ── Folder ↔ Decision junction ── */
export const folderDecisions = pgTable("folder_decisions", {
  folderId: uuid("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
  decisionId: uuid("decision_id").notNull().references(() => savedDecisions.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.folderId, t.decisionId] }),
]);

/* ── Tags ── */
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
}, (t) => [
  unique("tags_user_name_unique").on(t.userId, t.name),
]);

/* ── Decision ↔ Tag junction ── */
export const decisionTags = pgTable("decision_tags", {
  decisionId: uuid("decision_id").notNull().references(() => savedDecisions.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.decisionId, t.tagId] }),
]);

/* ── Notes ── */
export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  decisionId: uuid("decision_id").notNull().references(() => savedDecisions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isPrivate: boolean("is_private").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ── Saved Searches ── */
export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  searchParams: jsonb("search_params").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
}, (t) => [
  unique("saved_searches_user_name_unique").on(t.userId, t.name),
]);

/* ── Alerts ── */
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  savedSearchId: uuid("saved_search_id").notNull().references(() => savedSearches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  frequency: text("frequency").notNull(), // 'daily' | 'weekly'
  enabled: boolean("enabled").default(true).notNull(),
  notifyOnlyNew: boolean("notify_only_new").default(true).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("alerts_saved_search_unique").on(t.savedSearchId),
]);

/* ── Alert Executions ── */
export const alertExecutions = pgTable("alert_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status").notNull(),
  resultsCount: integer("results_count").default(0),
  newResultsCount: integer("new_results_count").default(0),
  errorCode: text("error_code"),
  durationMs: integer("duration_ms"),
});

/* ── Alert Seen Decisions ── */
export const alertSeenDecisions = pgTable("alert_seen_decisions", {
  alertId: uuid("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  decisionRoj: text("decision_roj").notNull(),
  decisionEcli: text("decision_ecli"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("alert_seen_decision_unique").on(t.alertId, t.decisionRoj),
]);

/* ── Email Deliveries ── */
export const emailDeliveries = pgTable("email_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertId: uuid("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  executionId: uuid("execution_id").references(() => alertExecutions.id, { onDelete: "set null" }),
  recipient: text("recipient").notNull(),
  status: text("status").notNull(),
  providerMessageId: text("provider_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  errorCode: text("error_code"),
});

/* ── News Analyses ── */
export const newsAnalyses = pgTable("news_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  articleUrl: text("article_url").notNull(),
  articleTitle: text("article_title"),
  publication: text("publication"),
  publishedAt: text("published_at"),
  decisionRoj: text("decision_roj"),
  decisionEcli: text("decision_ecli"),
  matchStatus: text("match_status").notNull(), // VERIFIED|PROBABLE|AMBIGUOUS|NOT_FOUND
  matchConfidence: real("match_confidence"),
  analysisBasis: text("analysis_basis"), // FULL_TEXT|OFFICIAL_SUMMARY|METADATA_ONLY
  comparisonResult: jsonb("comparison_result").notNull(), // full NewsComparisonResult
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
});

/* ── Documents ── */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalType: text("original_type"), // pdf|docx|txt
  sizeBytes: integer("size_bytes"),
  textLength: integer("text_length"),
  extractionMethod: text("extraction_method"),
  pages: integer("pages"),
  docType: text("doc_type"), // DEMANDA|CONTESTACION|RECURSO|ESCRITO_ALEGACIONES|SENTENCIA|AUTO|INFORME|CONTRATO|OTRO — nullable, filled later
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ── Document Analyses ── */
export const documentAnalyses = pgTable("document_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  docType: text("doc_type").notNull(),
  issues: jsonb("issues").notNull(), // array of extracted issues
  arguments: jsonb("arguments").notNull(), // array of extracted arguments
  citations: jsonb("citations").notNull(), // array of extracted citations
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ── Document Research Results ── */
export const documentResearchResults = pgTable("document_research_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  analysisId: uuid("analysis_id").notNull().references(() => documentAnalyses.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  issueText: text("issue_text").notNull(),
  decisionRoj: text("decision_roj"),
  decisionEcli: text("decision_ecli"),
  organo: text("organo"),
  fecha: text("fecha"),
  relationship: text("relationship").notNull(), // SUPPORTS|CONTRADICTS|DISTINGUISHES|NEUTRAL|INSUFFICIENT
  reason: text("reason"),
  evidenceBasis: text("evidence_basis").notNull(), // FULL_TEXT|OFFICIAL_SUMMARY|METADATA_ONLY
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ── Beta Feedback ── */
export const betaFeedback = pgTable("beta_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  feedbackType: text("feedback_type").notNull(),
  description: text("description"),
  context: jsonb("context"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ── Saved Documents (workspace document analyses) ── */
export const savedDocuments = pgTable("saved_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  analysisId: uuid("analysis_id").references(() => documentAnalyses.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  originalType: text("original_type"), // pdf|docx|txt
  docType: text("doc_type"), // classification
  issueCount: integer("issue_count").default(0),
  argumentCount: integer("argument_count").default(0),
  citationCount: integer("citation_count").default(0),
  analysisSnapshot: jsonb("analysis_snapshot"), // full analysis data (issues, arguments, citations)
  researchSnapshot: jsonb("research_snapshot"), // full research results
  savedAt: timestamp("saved_at", { withTimezone: true }).defaultNow().notNull(),
});
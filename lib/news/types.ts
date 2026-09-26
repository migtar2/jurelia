// News analysis pipeline types

export interface StructuredData {
  /** JSON-LD @type (e.g. "NewsArticle", "Article") */
  json_ld_type?: string;
  headline?: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string | string[];
  publisher?: string;
  image?: string;
  mainEntityOfPage?: string;
  /** Open Graph fields */
  og?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    site_name?: string;
    type?: string;
    author?: string;
    published_time?: string;
    modified_time?: string;
  };
  /** Twitter Card fields */
  twitter?: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
    site?: string;
    creator?: string;
  };
}

export interface ArticleData {
  url: string;
  title: string | null;
  publication: string | null;
  author: string | null;
  publication_date: string | null;
  canonical_url: string | null;
  headline: string | null;
  article_text: string;
  html_length: number;
  extraction_method: "static" | "readability" | "json-ld" | "og-fallback";
  /** Structured data extracted from JSON-LD, Open Graph, Twitter Cards */
  structured_data: StructuredData | null;
  /** 0-1 confidence in extraction quality */
  extraction_confidence: number;
  /** Warnings for partial extractions */
  warnings: string[];
  /** Whether multi-page continuation was detected */
  has_continuation: boolean;
  /** Date the article was last modified (ISO 8601) */
  modified_date: string | null;
}

export interface LegalField<T> {
  value: T;
  source: "explicit" | "inferred" | "ai_generated";
  /** Extraction confidence 0.0–1.0. Added in v2; absent in legacy output. */
  confidence?: number;
}

export interface LegalMetadata {
  court: LegalField<string> | null;
  chamber: LegalField<string> | null;
  jurisdiction: LegalField<string> | null;
  decision_date: LegalField<string> | null;
  resolution_number: LegalField<string> | null;
  resolution_type: LegalField<string> | null;
  appeal_number: LegalField<string> | null;
  roj: LegalField<string> | null;
  ecli: LegalField<string> | null;
  judge: LegalField<string> | null;
  legal_topics: LegalField<string[]>;
  laws: LegalField<string[]>;
  quoted_phrases: LegalField<string[]>;
  entities: LegalField<string[]>;
  summary: LegalField<string> | null;
  /** Warnings generated during extraction (low confidence, ambiguity, etc.) */
  extraction_warnings?: string[];
  /** True if any field was populated or enhanced by AI */
  ai_extracted?: boolean;
}

export interface SearchAttempt {
  attempt: number;
  type: string;
  params: Record<string, string>;
  result_count: number;
  duration_ms: number;
}

export interface EvidenceItem {
  field: string;
  status: "match" | "mismatch" | "missing";
  article_value?: string;
  candidate_value?: string;
  confidence: number;
}

export type SourceLevel = "FULL_TEXT" | "OFFICIAL_SUMMARY" | "METADATA_ONLY";

export interface CendojCandidate {
  id: string;
  titulo: string;
  fecha?: string;
  organo?: string;
  sede?: string;
  ponente?: string;
  n_recurso?: string;
  n_resolucion?: string;
  roj?: string;
  ecli?: string;
  url_pdf: string;
  resumen?: string;
  match_score: number;
  match_reasons: string[];
  match_status: "VERIFIED" | "PROBABLE" | "AMBIGUOUS" | "NOT_FOUND";
  rejected_reason?: string;
}

export interface MatchResult {
  status: "VERIFIED" | "PROBABLE" | "AMBIGUOUS" | "NOT_FOUND";
  confidence: number;
  candidate: CendojCandidate | null;
  candidates: CendojCandidate[];
  evidence: string[];
  evidence_items: EvidenceItem[];
  search_attempts: SearchAttempt[];
  explanation: string;
  source_level: SourceLevel;
}

export interface NewsAnalysisResult {
  request_id: string;
  article: ArticleData;
  legal_metadata: LegalMetadata;
  match: MatchResult;
  diagnostics: {
    url: string;
    http_status: number;
    extractor: string;
    extraction_ms: number;
    search_ms: number;
    verification_ms: number;
    total_ms: number;
    errors: string[];
  };
}
/* ── Proposition Analysis Types ── */

export type RelationshipType =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "DISTINGUISHES"
  | "NEUTRAL"
  | "INSUFFICIENT_EVIDENCE";

export type EvidenceLevel = "FULL_TEXT" | "OFFICIAL_SUMMARY" | "METADATA_ONLY";

export interface PropositionDecisionInput {
  roj: string;
  ecli?: string;
  organo?: string;
  fecha?: string;
  titulo: string;
  ponente?: string;
  url_pdf: string;
  resumen?: string;
  n_recurso?: string;
  n_resolucion?: string;
  sede?: string;
}

export interface PropositionRequest {
  proposition: string;
  court_filter?: string;
  date_from?: string;
  date_to?: string;
}

export interface PropositionAnalyzedDecision {
  roj: string;
  ecli?: string;
  organo?: string;
  fecha?: string;
  titulo: string;
  ponente?: string;
  url_pdf: string;
  resumen?: string;
  n_recurso?: string;
  n_resolucion?: string;
  sede?: string;
  relationship: RelationshipType;
  evidence_basis: string;
  reasoning: string;
  evidence_level: EvidenceLevel;
  provenance: "AI_GENERATED";
}

export interface PropositionResult {
  proposition: string;
  search_query_used: string;
  total_decisions_found: number;
  total_analyzed: number;
  supporting: PropositionAnalyzedDecision[];
  contradicting: PropositionAnalyzedDecision[];
  distinguishing: PropositionAnalyzedDecision[];
  neutral: PropositionAnalyzedDecision[];
  insufficient_evidence: PropositionAnalyzedDecision[];
  provenance: "AI_GENERATED";
  uncertainty: string | null;
  disclaimer: string;
}
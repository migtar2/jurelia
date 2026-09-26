export interface WorkspaceItem {
  id: string;
  type: 'decision' | 'comparison' | 'proposition';
  roj: string;
  ecli?: string;
  organo: string;
  fecha: string;
  titulo: string;
  ponente?: string;
  url_pdf: string;
  resumen?: string;
  folders: string[];
  tags: string[];
  notes: string;
  savedAt: string;
  aiSummary?: Record<string, unknown>;
  // For comparison items
  comparisonData?: ComparisonWorkspaceData;
  // For proposition items
  propositionData?: PropositionWorkspaceData;
}

export interface ComparisonWorkspaceData {
  decisionA: { roj: string; titulo: string; organo?: string; fecha?: string };
  decisionB: { roj: string; titulo: string; organo?: string; fecha?: string };
  sections: { key: string; label: string; comparison: string }[];
  similarities: string[];
  differences: string[];
  relevant_distinction: string;
  evidence_summary: { decision_a: string; decision_b: string; analysis_basis: string; confidence: string };
  uncertainty: string | null;
}

export interface PropositionWorkspaceData {
  proposition: string;
  search_query_used: string;
  total_decisions_found: number;
  total_analyzed: number;
  counts: { supporting: number; contradicting: number; distinguishing: number; neutral: number; insufficient_evidence: number };
  decisions: PropositionDecisionRef[];
  uncertainty: string | null;
}

export interface PropositionDecisionRef {
  roj: string;
  titulo: string;
  organo?: string;
  fecha?: string;
  relationship: string;
  evidence_basis: string;
  reasoning: string;
}

export interface WorkspaceExport {
  version: 1;
  exportedAt: string;
  items: WorkspaceItem[];
  folders: string[];
}

export interface SavedDocument {
  id: string;
  document_id: string;
  analysis_id: string | null;
  filename: string;
  original_type: string | null;
  doc_type: string | null;
  issue_count: number;
  argument_count: number;
  citation_count: number;
  analysis_snapshot: Record<string, unknown> | null;
  research_snapshot: Record<string, unknown> | null;
  saved_at: string;
}
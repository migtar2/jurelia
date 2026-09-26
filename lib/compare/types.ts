export interface CompareDecision {
  roj: string;
  ecli?: string;
  organo: string;
  fecha: string;
  titulo: string;
  ponente?: string;
  url_pdf: string;
  resumen?: string;
  n_recurso?: string;
  n_resolucion?: string;
  sede?: string;
  aiSummary?: Record<string, unknown>;
}

export interface CompareSelection {
  a: CompareDecision | null;
  b: CompareDecision | null;
}

export interface ComparisonSection {
  key: string;
  label: string;
  icon: string;
  content_a: string;
  content_b: string;
  comparison: string;
  evidence_level: "FULL_TEXT" | "OFFICIAL_SUMMARY" | "METADATA_ONLY";
  provenance: "AI_GENERATED" | "SOURCE_FACT" | "INFERRED";
}

export interface ComparisonResult {
  sections: ComparisonSection[];
  similarities: string[];
  differences: string[];
  relevant_distinction: string;
  metadata_comparison: {
    tribunal: { a: string; b: string };
    sala: { a: string; b: string };
    jurisdiccion: { a: string; b: string };
    fecha: { a: string; b: string };
    roj: { a: string; b: string };
    ecli: { a: string; b: string };
    n_resolucion: { a: string; b: string };
    n_recurso: { a: string; b: string };
    ponente: { a: string; b: string };
    tipo: { a: string; b: string };
  };
  evidence_summary: {
    decision_a: string;
    decision_b: string;
    analysis_basis: string;
    confidence: string;
  };
  provenance: "AI_GENERATED";
  uncertainty: string | null;
}
// Article vs Decision comparison types

export type ClaimType = 'holding' | 'factual' | 'procedural' | 'opinion';

export type ClaimStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_SUPPORTED' | 'CANNOT_VERIFY';

export type HeadlineAccuracy = 'SUPPORTED' | 'OVERSTATED' | 'PARTIAL' | 'CANNOT_VERIFY';

export type AnalysisBasis = 'FULL_TEXT' | 'OFFICIAL_SUMMARY' | 'METADATA_ONLY';

export type Provenance = 'SOURCE_FACT' | 'AI_GENERATED' | 'INFERRED';

export interface ExtractedClaim {
  id: string;
  text: string;
  type: ClaimType;
  confidence: number;
  status: ClaimStatus;
  evidence: string;
  provenance: Provenance;
}

export interface ClaimExtractionResult {
  claims: ExtractedClaim[];
  provenance: 'AI_GENERATED';
}

export interface NewsComparisonResult {
  identification: {
    article: {
      title: string | null;
      publication: string | null;
      url: string;
      date: string | null;
    };
    decision: {
      titulo: string;
      organo: string | null;
      roj: string | null;
      ecli: string | null;
      fecha: string | null;
      ponente: string | null;
      url_pdf: string | null;
    };
  };
  matches: string[];
  claims: ExtractedClaim[];
  nuances: string[];
  headline_accuracy: HeadlineAccuracy;
  headline_accuracy_explanation: string;
  conclusion: string;
  analysis_basis: AnalysisBasis;
  provenance: 'AI_GENERATED';
  uncertainty: string | null;
}
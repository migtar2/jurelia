/* ── Export / Copy utilities for comparison and proposition results ── */

interface CopySection {
  key: string;
  label: string;
  content_a?: string;
  content_b?: string;
  comparison?: string;
}

interface CopyComparisonInput {
  decisionA: { roj: string; titulo: string; organo?: string; fecha?: string };
  decisionB: { roj: string; titulo: string; organo?: string; fecha?: string };
  sections: CopySection[];
  similarities: string[];
  differences: string[];
  relevant_distinction: string;
  evidence_summary: { decision_a: string; decision_b: string; analysis_basis: string; confidence: string };
  uncertainty: string | null;
}

export function formatComparisonAsText(data: CopyComparisonInput): string {
  const lines: string[] = [];
  lines.push("# Comparación de Resoluciones");
  lines.push("");
  lines.push(`**Resolución A:** ${data.decisionA.titulo} (ROJ: ${data.decisionA.roj})`);
  lines.push(`**Resolución B:** ${data.decisionB.titulo} (ROJ: ${data.decisionB.roj})`);
  lines.push("");

  lines.push("## Secciones comparativas");
  lines.push("");
  for (const section of data.sections) {
    lines.push(`### ${section.label}`);
    if (section.content_a) lines.push(`**A:** ${section.content_a}`);
    if (section.content_b) lines.push(`**B:** ${section.content_b}`);
    if (section.comparison) lines.push(`**Análisis:** ${section.comparison}`);
    lines.push("");
  }

  if (data.similarities.length > 0) {
    lines.push("## Similitudes");
    for (const s of data.similarities) lines.push(`- ${s}`);
    lines.push("");
  }

  if (data.differences.length > 0) {
    lines.push("## Diferencias");
    for (const d of data.differences) lines.push(`- ${d}`);
    lines.push("");
  }

  if (data.relevant_distinction) {
    lines.push("## Distinción relevante");
    lines.push(data.relevant_distinction);
    lines.push("");
  }

  lines.push("## Evidencia");
  lines.push(`- **A:** ${data.evidence_summary.decision_a}`);
  lines.push(`- **B:** ${data.evidence_summary.decision_b}`);
  lines.push(`- **Base:** ${data.evidence_summary.analysis_basis}`);
  lines.push(`- **Confianza:** ${data.evidence_summary.confidence}`);
  lines.push("");

  if (data.uncertainty) {
    lines.push("## Incertidumbre");
    lines.push(data.uncertainty);
    lines.push("");
  }

  lines.push("---");
  lines.push("Generado por JURELIA — Análisis orientativo con IA. No constituye asesoramiento jurídico.");
  return lines.join("\n");
}

export interface CopyPropositionInput {
  proposition: string;
  search_query_used: string;
  total_decisions_found: number;
  total_analyzed: number;
  supporting: { roj: string; titulo: string; organo?: string; evidence_basis: string; reasoning: string }[];
  contradicting: { roj: string; titulo: string; organo?: string; evidence_basis: string; reasoning: string }[];
  distinguishing: { roj: string; titulo: string; organo?: string; evidence_basis: string; reasoning: string }[];
  neutral: { roj: string; titulo: string; organo?: string; evidence_basis: string; reasoning: string }[];
  insufficient_evidence: { roj: string; titulo: string; organo?: string; evidence_basis: string; reasoning: string }[];
  uncertainty: string | null;
}

export function formatPropositionAsText(data: CopyPropositionInput): string {
  const lines: string[] = [];
  lines.push("# Análisis de Proposición Jurídica");
  lines.push("");
  lines.push(`**Proposición:** "${data.proposition}"`);
  lines.push(`**Búsqueda:** ${data.search_query_used}`);
  lines.push(`**Resoluciones encontradas:** ${data.total_decisions_found}`);
  lines.push(`**Resoluciones analizadas:** ${data.total_analyzed}`);
  lines.push("");

  const groups: [string, typeof data.supporting][] = [
    ["Apoyan", data.supporting],
    ["Contradicen", data.contradicting],
    ["Distinguen", data.distinguishing],
    ["Neutrales", data.neutral],
    ["Evidencia insuficiente", data.insufficient_evidence],
  ];

  for (const [label, decisions] of groups) {
    if (decisions.length === 0) continue;
    lines.push(`## ${label} (${decisions.length})`);
    for (const d of decisions) {
      lines.push(`- **${d.roj}** — ${d.titulo}${d.organo ? ` (${d.organo})` : ""}`);
      lines.push(`  - Base: ${d.evidence_basis}`);
      lines.push(`  - Razonamiento: ${d.reasoning}`);
    }
    lines.push("");
  }

  if (data.uncertainty) {
    lines.push("## Incertidumbre");
    lines.push(data.uncertainty);
    lines.push("");
  }

  lines.push("---");
  lines.push("Generado por JURELIA — Análisis orientativo con IA. No constituye asesoramiento jurídico.");
  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
}

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Document analysis export utilities ── */

export interface DocumentExportIssue {
  issue: string;
  evidence: string;
  confidence: number;
  provenance: "SOURCE_FACT" | "INFERRED";
}
export interface DocumentExportArgument {
  argument: string;
  document_location: string;
  related_issue: string;
  confidence: number;
  provenance: "SOURCE_FACT" | "INFERRED";
}
export interface DocumentExportCitation {
  text: string;
  type: string;
  normalized: string;
  status: string;
}
export interface DocumentExportResearchCandidate {
  decision_roj: string | null;
  decision_ecli: string | null;
  organo: string | null;
  fecha: string | null;
  titulo: string | null;
  relationship: string;
  reason: string;
  evidence_basis: string;
  source_url: string;
}
export interface DocumentExportResearchResult {
  issue_text: string;
  candidates: DocumentExportResearchCandidate[];
}
export interface DocumentExportGapAnalysis {
  issues_without_jurisprudence: string[];
  cited_cases_unresolved: string[];
  only_lower_court: string[];
  missing_contrary: string[];
}
export interface DocumentExportInput {
  filename: string;
  original_type?: string;
  doc_type: string;
  issues: DocumentExportIssue[];
  arguments: DocumentExportArgument[];
  citations: DocumentExportCitation[];
  research_results?: DocumentExportResearchResult[];
  gap_analysis?: DocumentExportGapAnalysis;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  DEMANDA: "Demanda",
  CONTESTACION: "Contestación",
  RECURSO: "Recurso",
  ESCRITO_ALEGACIONES: "Escrito de alegaciones",
  SENTENCIA: "Sentencia",
  AUTO: "Auto",
  INFORME: "Informe",
  CONTRATO: "Contrato",
  OTRO: "Otro",
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  SUPPORTS: "Apoya",
  CONTRADICTS: "Contradice",
  DISTINGUISHES: "Distingue",
  NEUTRAL: "Neutral",
  INSUFFICIENT_EVIDENCE: "Sin evidencia",
};

const PROVENANCE_BADGES: Record<string, string> = {
  SOURCE_FACT: "📄 Fuente",
  INFERRED: "🔮 Inferido",
};

export function formatDocumentAnalysisAsMarkdown(data: DocumentExportInput): string {
  const lines: string[] = [];
  const date = new Date().toLocaleDateString("es-ES");

  lines.push("# JURELIA — Análisis de Documento Jurídico");
  lines.push("");
  lines.push(`> Generado el ${date} · ⚠️ Generado con IA — Verificar siempre con fuentes oficiales`);
  lines.push("");

  // Document info
  lines.push("## Documento");
  lines.push("");
  lines.push(`- **Archivo:** ${data.filename}`);
  if (data.original_type) lines.push(`- **Tipo original:** ${data.original_type}`);
  lines.push(`- **Clasificación:** ${DOC_TYPE_LABELS[data.doc_type] ?? data.doc_type}`);
  lines.push(`- **Fecha del análisis:** ${date}`);
  lines.push("");

  // Issues
  if (data.issues.length > 0) {
    lines.push("## Cuestiones identificadas");
    lines.push("");
    for (let i = 0; i < data.issues.length; i++) {
      const iss = data.issues[i];
      const badge = PROVENANCE_BADGES[iss.provenance] ?? iss.provenance;
      lines.push(`### ${i + 1}. ${iss.issue}`);
      lines.push("");
      lines.push(`**Evidencia:** ${iss.evidence}`);
      lines.push(`**Confianza:** ${Math.round(iss.confidence * 100)}% · ${badge}`);
      lines.push("");
    }
  }

  // Arguments
  if (data.arguments.length > 0) {
    lines.push("## Argumentos");
    lines.push("");
    for (const arg of data.arguments) {
      const badge = PROVENANCE_BADGES[arg.provenance] ?? arg.provenance;
      lines.push(`- **${arg.argument}**`);
      lines.push(`  - Ubicación: ${arg.document_location}`);
      lines.push(`  - Cuestión relacionada: ${arg.related_issue}`);
      lines.push(`  - Confianza: ${Math.round(arg.confidence * 100)}% · ${badge}`);
      lines.push("");
    }
  }

  // Citations
  if (data.citations.length > 0) {
    lines.push("## Citas encontradas en el documento");
    lines.push("");
    for (const cit of data.citations) {
      lines.push(`- 📎 **${cit.text}**`);
      lines.push(`  - Tipo: ${cit.type}`);
      if (cit.normalized) lines.push(`  - Normalizado: ${cit.normalized}`);
      lines.push(`  - Estado: ${cit.status}`);
      lines.push("");
    }
  }

  // Research results
  if (data.research_results && data.research_results.length > 0) {
    lines.push("## Jurisprudencia encontrada por cuestión");
    lines.push("");
    for (const rr of data.research_results) {
      lines.push(`### Cuestión: ${rr.issue_text}`);
      lines.push("");
      if (rr.candidates.length === 0) {
        lines.push("_No se encontró jurisprudencia relevante._");
        lines.push("");
        continue;
      }
      for (const c of rr.candidates) {
        const relLabel = RELATIONSHIP_LABELS[c.relationship] ?? c.relationship;
        const roj = c.decision_roj ?? "—";
        const ecli = c.decision_ecli ?? "";
        const title = c.titulo ?? "Sin título";
        const organo = c.organo ?? "—";
        const fecha = c.fecha ?? "—";
        lines.push(`- **${roj}**${ecli ? ` (${ecli})` : ""} — ${title}`);
        lines.push(`  - Órgano: ${organo} · Fecha: ${fecha}`);
        lines.push(`  - Relación: **${relLabel}**`);
        lines.push(`  - Razón: ${c.reason}`);
        lines.push(`  - Base probatoria: ${c.evidence_basis}`);
        if (c.source_url) lines.push(`  - Fuente: ${c.source_url}`);
      }
      lines.push("");
    }
  }

  // Gap analysis
  if (data.gap_analysis) {
    const ga = data.gap_analysis;
    const hasGaps =
      ga.issues_without_jurisprudence.length > 0 ||
      ga.cited_cases_unresolved.length > 0 ||
      ga.only_lower_court.length > 0 ||
      ga.missing_contrary.length > 0;

    if (hasGaps) {
      lines.push("## Análisis de brechas");
      lines.push("");
      if (ga.issues_without_jurisprudence.length > 0) {
        lines.push("### Cuestiones sin jurisprudencia");
        for (const g of ga.issues_without_jurisprudence) lines.push(`- ${g}`);
        lines.push("");
      }
      if (ga.cited_cases_unresolved.length > 0) {
        lines.push("### Citas sin resolver");
        for (const g of ga.cited_cases_unresolved) lines.push(`- ${g}`);
        lines.push("");
      }
      if (ga.only_lower_court.length > 0) {
        lines.push("### Solo con jurisprudencia de instancia inferior");
        for (const g of ga.only_lower_court) lines.push(`- ${g}`);
        lines.push("");
      }
      if (ga.missing_contrary.length > 0) {
        lines.push("### Falta jurisprudencia contraria");
        for (const g of ga.missing_contrary) lines.push(`- ${g}`);
        lines.push("");
      }
    }
  }

  lines.push("---");
  lines.push("Generado por JURELIA — Análisis orientativo con IA. No constituye asesoramiento jurídico.");
  return lines.join("\n");
}

export function downloadDocumentJSON(data: DocumentExportInput): void {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `jurelia-document-${safeName}-${date}.json`;

  // Build export object, explicitly excluding any raw document text
  const exportData = {
    filename: data.filename,
    original_type: data.original_type,
    doc_type: data.doc_type,
    doc_type_label: DOC_TYPE_LABELS[data.doc_type] ?? data.doc_type,
    issues: data.issues,
    arguments: data.arguments,
    citations: data.citations,
    research_results: data.research_results,
    gap_analysis: data.gap_analysis,
    exported_at: new Date().toISOString(),
  };

  downloadJSON(exportData, filename);
}
// Independent match verifier — scores candidates against article metadata
// v2.0: Structured evidence, strict VERIFIED rules, source level detection

import type { LegalMetadata, CendojCandidate, MatchResult, SearchAttempt, EvidenceItem, SourceLevel } from "../news/types";
import type { CendojSearchResult } from "../cendoj/client";

export function verifyMatches(
  meta: LegalMetadata,
  candidates: CendojSearchResult[],
  attempts: SearchAttempt[],
  sourceLevel?: SourceLevel,
): MatchResult {
  const detectedSourceLevel = sourceLevel ?? inferSourceLevel(meta);

  if (candidates.length === 0) {
    return {
      status: "NOT_FOUND",
      confidence: 0,
      candidate: null,
      candidates: [],
      evidence: ["No se encontraron candidatos en CENDOJ"],
      evidence_items: buildEvidenceItems(meta, null),
      search_attempts: attempts,
      explanation: "No se encontraron resoluciones compatibles en CENDOJ.",
      source_level: detectedSourceLevel,
    };
  }

  // Score each candidate
  const scored: CendojCandidate[] = candidates.map((c) => {
    const { score, reasons } = scoreCandidate(meta, c, attempts);
    return {
      ...c,
      match_score: score,
      match_reasons: reasons,
      match_status: "NOT_FOUND", // Will be set below
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.match_score - a.match_score);

  const best = scored[0];
  const secondBest = scored.length > 1 ? scored[1] : null;

  // Determine hard identifiers
  const hasExactECLI = !!(meta.ecli?.value && best.ecli && normalize(meta.ecli.value) === normalize(best.ecli));
  const hasExactROJ = !!(meta.roj?.value && best.roj && normalize(meta.roj.value) === normalize(best.roj));
  const hasStrongCombination = hasStrongIdentifierCombo(meta, best);

  // Classify based on score, identifiers, and gap
  let status: MatchResult["status"];
  let explanation: string;

  if (hasExactECLI || hasExactROJ) {
    // HARD IDENTIFIER match → always VERIFIED
    status = "VERIFIED";
    explanation = hasExactECLI
      ? "Identificador ECLI coincide exactamente con la resolución encontrada."
      : "Identificador ROJ coincide exactamente con la resolución encontrada.";
  } else if (hasStrongCombination && best.match_score >= 80) {
    // Strong combination (resolution_number + court + date + appeal) → VERIFIED
    status = "VERIFIED";
    explanation = "Múltiples señales fuertes coinciden: número de resolución, tribunal, fecha y número de recurso.";
  } else if (best.match_score >= 80) {
    // High score but no hard identifier → PROBABLE, never VERIFIED
    status = "PROBABLE";
    explanation = "Coincidencia considerable pero falta un identificador decisivo (ECLI/ROJ). No se puede confirmar al 100%.";
  } else if (best.match_score >= 50) {
    // Check if multiple candidates have similar scores (ambiguous)
    if (secondBest && secondBest.match_score >= best.match_score - 15) {
      status = "AMBIGUOUS";
      explanation = "Más de una resolución plausible. Se necesitan más datos para distinguir.";
    } else {
      status = "PROBABLE";
      explanation = "Posible coincidencia pero con señales débiles.";
    }
  } else if (best.match_score >= 20) {
    status = "AMBIGUOUS";
    explanation = "Coincidencias débiles. No hay suficiente evidencia para un veredicto claro.";
  } else {
    status = "NOT_FOUND";
    explanation = "No se encontró una resolución con suficiente evidencia de correspondencia.";
  }

  // CRITICAL: Never produce VERIFIED from semantic similarity alone
  // Semantic-only means: no ECLI, no ROJ, no resolution_number, no appeal_number
  if (status === "VERIFIED") {
    const hasAnyHardId = !!(meta.ecli?.value || meta.roj?.value || meta.resolution_number?.value || meta.appeal_number?.value);
    if (!hasAnyHardId) {
      status = "PROBABLE";
      explanation += " [Downgrade: sin identificadores duros, no se puede confirmar VERIFIED.]";
    }
  }

  // Assign statuses to all candidates
  for (const c of scored) {
    if (c === best && status === "VERIFIED") {
      c.match_status = "VERIFIED";
    } else if (c.match_score >= 50) {
      c.match_status = "PROBABLE";
    } else if (c.match_score >= 20) {
      c.match_status = "AMBIGUOUS";
    } else {
      c.match_status = "NOT_FOUND";
    }
  }

  // Build structured evidence for best candidate
  const evidenceItems = buildEvidenceItems(meta, best);

  // Build rejection reasons for non-selected candidates (top 5)
  for (const c of scored.slice(0, 5)) {
    if (c !== best) {
      c.rejected_reason = buildRejectionReason(best, c);
    }
  }

  return {
    status,
    confidence: best.match_score,
    candidate: status === "VERIFIED" || status === "PROBABLE" ? best : null,
    candidates: scored.slice(0, 5),
    evidence: best.match_reasons,
    evidence_items: evidenceItems,
    search_attempts: attempts,
    explanation,
    source_level: detectedSourceLevel,
  };
}

// ─── Structured evidence builder ─────────────────────────────────────────────

function buildEvidenceItems(meta: LegalMetadata, candidate: CendojCandidate | null): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  // ECLI
  if (meta.ecli?.value && candidate?.ecli) {
    const matches = normalize(meta.ecli.value) === normalize(candidate.ecli);
    items.push({
      field: "ECLI",
      status: matches ? "match" : "mismatch",
      article_value: meta.ecli.value,
      candidate_value: candidate.ecli,
      confidence: matches ? 1.0 : 0,
    });
  } else if (meta.ecli?.value) {
    items.push({
      field: "ECLI",
      status: "missing",
      article_value: meta.ecli.value,
      confidence: 0,
    });
  } else {
    items.push({
      field: "ECLI",
      status: "missing",
      confidence: 0,
    });
  }

  // ROJ
  if (meta.roj?.value && candidate?.roj) {
    const matches = normalize(meta.roj.value) === normalize(candidate.roj);
    items.push({
      field: "ROJ",
      status: matches ? "match" : "mismatch",
      article_value: meta.roj.value,
      candidate_value: candidate.roj,
      confidence: matches ? 1.0 : 0,
    });
  } else if (meta.roj?.value) {
    items.push({
      field: "ROJ",
      status: "missing",
      article_value: meta.roj.value,
      confidence: 0,
    });
  } else {
    items.push({
      field: "ROJ",
      status: "missing",
      confidence: 0,
    });
  }

  // Tribunal
  if (meta.court?.value && candidate?.organo) {
    const matches = fuzzyContains(meta.court.value, candidate.organo);
    items.push({
      field: "Tribunal",
      status: matches ? "match" : "mismatch",
      article_value: meta.court.value,
      candidate_value: candidate.organo,
      confidence: matches ? 0.9 : 0,
    });
  } else {
    items.push({
      field: "Tribunal",
      status: "missing",
      confidence: 0,
    });
  }

  // Fecha
  if (meta.decision_date?.value && candidate?.fecha) {
    const metaDate = parseDate(meta.decision_date.value);
    const candDate = parseDate(candidate.fecha);
    if (metaDate && candDate) {
      const diffDays = Math.abs(metaDate.getTime() - candDate.getTime()) / (1000 * 60 * 60 * 24);
      const matches = diffDays === 0;
      items.push({
        field: "Fecha",
        status: matches ? "match" : diffDays <= 7 ? "match" : "mismatch",
        article_value: meta.decision_date.value,
        candidate_value: candidate.fecha,
        confidence: diffDays === 0 ? 1.0 : diffDays <= 7 ? 0.7 : 0,
      });
    } else {
      items.push({
        field: "Fecha",
        status: "missing",
        confidence: 0,
      });
    }
  } else {
    items.push({
      field: "Fecha",
      status: "missing",
      confidence: 0,
    });
  }

  // Nº recurso
  if (meta.appeal_number?.value && candidate?.n_recurso) {
    const matches = normalize(meta.appeal_number.value) === normalize(candidate.n_recurso);
    items.push({
      field: "Nº recurso",
      status: matches ? "match" : "mismatch",
      article_value: meta.appeal_number.value,
      candidate_value: candidate.n_recurso,
      confidence: matches ? 0.95 : 0,
    });
  } else {
    items.push({
      field: "Nº recurso",
      status: "missing",
      confidence: 0,
    });
  }

  // Materia / legal topics
  if (meta.legal_topics?.value && meta.legal_topics.value.length > 0 && candidate?.resumen) {
    const topicMatches = meta.legal_topics.value.filter(t => fuzzyContains(t, candidate.resumen || ""));
    items.push({
      field: "Materia",
      status: topicMatches.length > 0 ? "match" : "mismatch",
      article_value: meta.legal_topics.value.join(", "),
      candidate_value: `${topicMatches.length}/${meta.legal_topics.value.length} temas`,
      confidence: topicMatches.length > 0 ? Math.min(topicMatches.length * 0.2, 0.8) : 0,
    });
  } else {
    items.push({
      field: "Materia",
      status: "missing",
      confidence: 0,
    });
  }

  return items;
}

// ─── Rejection reason builder ────────────────────────────────────────────────

function buildRejectionReason(best: CendojCandidate, rejected: CendojCandidate): string {
  const gap = best.match_score - rejected.match_score;
  const reasons: string[] = [];

  if (rejected.match_score < 20) {
    return "Puntuación demasiado baja para ser considerado.";
  }

  // Compare specific fields
  if (best.organo && rejected.organo && normalize(best.organo) !== normalize(rejected.organo)) {
    reasons.push("tribunal diferente");
  }
  if (best.fecha && rejected.fecha && best.fecha !== rejected.fecha) {
    reasons.push("fecha diferente");
  }
  if (best.roj && rejected.roj && normalize(best.roj) !== normalize(rejected.roj)) {
    reasons.push("ROJ diferente");
  }
  if (best.n_recurso && rejected.n_recurso && normalize(best.n_recurso) !== normalize(rejected.n_recurso)) {
    reasons.push("nº recurso diferente");
  }

  if (reasons.length > 0) {
    return `Rechazado: ${reasons.join(", ")}. Diferencia de ${gap} puntos.`;
  }

  return `Puntuación inferior (${rejected.match_score}% vs ${best.match_score}%). Diferencia de ${gap} puntos.`;
}

// ─── Source level inference ──────────────────────────────────────────────────

function inferSourceLevel(meta: LegalMetadata): SourceLevel {
  // If we have explicit identifiers from the text, we had good text access
  const hasExplicitFields = !!(
    meta.ecli?.source === "explicit" ||
    meta.roj?.source === "explicit" ||
    meta.resolution_number?.source === "explicit"
  );

  // If all key fields are AI-generated, we likely only had a summary
  const allAI = !!(
    meta.court?.source === "ai_generated" &&
    !meta.ecli?.value &&
    !meta.roj?.value
  );

  if (hasExplicitFields) {
    return "OFFICIAL_SUMMARY"; // We got identifiers from text — likely summary with ROJ/ECLI
  }

  if (allAI) {
    return "METADATA_ONLY";
  }

  // Default: we had text access (summary or full)
  return "OFFICIAL_SUMMARY";
}

// ─── Strong combination check ───────────────────────────────────────────────

function hasStrongIdentifierCombo(meta: LegalMetadata, candidate: CendojSearchResult): boolean {
  let strongCount = 0;

  if (meta.resolution_number?.value && candidate.n_resolucion &&
      normalize(meta.resolution_number.value) === normalize(candidate.n_resolucion)) {
    strongCount++;
  }
  if (meta.court?.value && candidate.organo &&
      fuzzyContains(meta.court.value, candidate.organo)) {
    strongCount++;
  }
  if (meta.decision_date?.value && candidate.fecha) {
    const metaDate = parseDate(meta.decision_date.value);
    const candDate = parseDate(candidate.fecha);
    if (metaDate && candDate) {
      const diffDays = Math.abs(metaDate.getTime() - candDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 0) strongCount++;
    }
  }
  if (meta.appeal_number?.value && candidate.n_recurso &&
      normalize(meta.appeal_number.value) === normalize(candidate.n_recurso)) {
    strongCount++;
  }

  return strongCount >= 3;
}

// ─── Has hard identifier check ──────────────────────────────────────────────

function hasHardIdentifier(meta: LegalMetadata): boolean {
  return !!(meta.ecli?.value || meta.roj?.value || meta.resolution_number?.value || meta.appeal_number?.value);
}

interface ScoreResult {
  score: number;
  reasons: string[];
}

function scoreCandidate(meta: LegalMetadata, candidate: CendojSearchResult, attempts: SearchAttempt[]): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // Check if candidate was found via constructed ROJ search (high confidence)
  const constructedAttempt = attempts.find(a => a.type === "constructed-ROJ" && a.result_count > 0);
  if (constructedAttempt && candidate.roj) {
    const searchRoj = constructedAttempt.params.roj;
    if (searchRoj && normalize(searchRoj) === normalize(candidate.roj)) {
      score += 50;
      reasons.push("ROJ construido coincide (tribunal + nº resolución)");
    }
  }

  // Check if candidate was found via brute-force ROJ search
  const bruteAttempt = attempts.find(a => (a.type === "brute-ROJ" || a.type === "brute-TSJ-ROJ") && a.result_count > 0);
  if (bruteAttempt && candidate.roj) {
    const searchRoj = bruteAttempt.params.roj;
    if (searchRoj && normalize(searchRoj) === normalize(candidate.roj)) {
      score += 45;
      reasons.push("ROJ encontrado por búsqueda exhaustiva (nº resolución)");
    }
  }

  // ECLI match (VERY HIGH)
  if (meta.ecli?.value && candidate.ecli) {
    if (normalize(meta.ecli.value) === normalize(candidate.ecli)) {
      score += 50;
      reasons.push("ECLI coincide exactamente");
    }
  }

  // ROJ match (VERY HIGH)
  if (meta.roj?.value && candidate.roj) {
    if (normalize(meta.roj.value) === normalize(candidate.roj)) {
      score += 45;
      reasons.push("ROJ coincide exactamente");
    }
  }

  // Resolution number match (HIGH)
  if (meta.resolution_number?.value && candidate.n_resolucion) {
    if (normalize(meta.resolution_number.value) === normalize(candidate.n_resolucion)) {
      score += 30;
      reasons.push("Número de resolución coincide");
    }
  }

  // Appeal number match (HIGH)
  if (meta.appeal_number?.value && candidate.n_recurso) {
    if (normalize(meta.appeal_number.value) === normalize(candidate.n_recurso)) {
      score += 28;
      reasons.push("Número de recurso coincide");
    }
  }

  // Court match (MEDIUM)
  if (meta.court?.value && candidate.organo) {
    if (fuzzyContains(meta.court.value, candidate.organo)) {
      score += 15;
      reasons.push("Tribunal coincide");
    }
  }

  // Chamber/sede match (MEDIUM)
  if (meta.chamber?.value && candidate.sede) {
    if (fuzzyContains(meta.chamber.value, candidate.sede)) {
      score += 8;
      reasons.push("Sede/Sala coincide");
    }
  }

  // Date match (MEDIUM)
  if (meta.decision_date?.value && candidate.fecha) {
    const metaDate = parseDate(meta.decision_date.value);
    const candDate = parseDate(candidate.fecha);
    if (metaDate && candDate) {
      const diffDays = Math.abs(metaDate.getTime() - candDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 0) {
        score += 15;
        reasons.push("Fecha coincide exactamente");
      } else if (diffDays <= 7) {
        score += 10;
        reasons.push(`Fecha aproximada (±${Math.round(diffDays)} días)`);
      } else if (diffDays <= 30) {
        score += 5;
        reasons.push(`Fecha cercana (±${Math.round(diffDays)} días)`);
      }
    }
  }

  // Judge/ponente match (MEDIUM)
  if (meta.judge?.value && candidate.ponente) {
    if (fuzzyContains(meta.judge.value, candidate.ponente)) {
      score += 12;
      reasons.push("Ponente coincide");
    }
  }

  // Jurisdiction match (LOW-MEDIUM)
  if (meta.jurisdiction?.value && candidate.titulo) {
    // Check if the jurisdiction appears in the title
    if (fuzzyContains(meta.jurisdiction.value, candidate.titulo)) {
      score += 5;
      reasons.push("Jurisdicción coincide");
    }
  }

  // Topic/content match (LOW-MEDIUM)
  if (meta.legal_topics?.value && meta.legal_topics.value.length > 0 && candidate.resumen) {
    const topicMatches = meta.legal_topics.value.filter((t) =>
      fuzzyContains(t, candidate.resumen || "")
    );
    if (topicMatches.length > 0) {
      score += Math.min(topicMatches.length * 3, 10);
      reasons.push(`Tema coincide (${topicMatches.length} keywords)`);
    }
  }

  // Quoted phrases match (HIGH)
  if (meta.quoted_phrases?.value && meta.quoted_phrases.value.length > 0 && candidate.resumen) {
    const quoteMatches = meta.quoted_phrases.value.filter((q) =>
      candidate.resumen && candidate.resumen.includes(q.substring(0, 30))
    );
    if (quoteMatches.length > 0) {
      score += 20;
      reasons.push(`Frase textual coincide (${quoteMatches.length})`);
    }
  }

  return { score: Math.min(score, 100), reasons };
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function fuzzyContains(a: string, b: string): boolean {
  const na = normalize(a).replace(/[^\wáéíóúñ]/g, "");
  const nb = normalize(b).replace(/[^\wáéíóúñ]/g, "");
  return nb.includes(na) || na.includes(nb);
}

function parseDate(s: string): Date | null {
  // Try YYYY-MM-DD
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  // Try DD/MM/YYYY
  const eu = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (eu) return new Date(parseInt(eu[3]), parseInt(eu[2]) - 1, parseInt(eu[1]));
  return null;
}
// Legal metadata extraction v2.0
// Enhanced patterns, confidence scoring, AI-assisted extraction

import type { LegalMetadata, LegalField } from "./types";

// ─── Regex patterns ────────────────────────────────────────────────────────────

// ECLI format: ECLI:ES:[tribunal_code]:[year]:[number]
// No `g` flag — we only need the first match; avoids stale lastIndex across calls
const ECLI_REGEX = /\bECLI:ES:[A-Z0-9]+:\d{4}:\d+[A-Z]?\b/i;

// ROJ format: prefix + optional letter(s) + number/year
const ROJ_REGEX = /\b(?:STS|STSJ|SAP|ATS|STC|SAN|AAP|AC|JUR|SS|TS)\s+[A-Z]*\s*\d+\/\d{4}\b/i;

// Resolution number patterns
const RES_NUM_REGEX = /\b(?:n[úu]mero\s+(?:de\s+)?resoluci[óo]n|sentencia\s+n[úu]m\.?|(?:núm|num|nº)\.?\s*(?:de\s+)?(?:sentencia|resoluci[óo]n)?)\s*:?\s*(\d+\/\d{4})\b/i;

// Appeal number patterns — added "rollo"
const APPEAL_NUM_REGEX = /\b(?:recurso|rec\.|apelaci[óo]n|casaci[óo]n|rollo)\s+(?:n[úu]mero\s+|n[úu]m\.?\s*|nº\s*)?:?\s*(\d+\/\d{4})\b/i;

// Rollo number (standalone)
const ROLLO_REGEX = /\b[Rr]ollo\s+(?:n[úu]m\.?\s*|nº\s*)?:?\s*(\d+\/\d{4})\b/i;

// Date patterns (Spanish)
const DATE_REGEX = /\b(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/i;

const MONTH_MAP: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04",
  mayo: "05", junio: "06", julio: "07", agosto: "08",
  septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

// ─── Resolution type patterns ──────────────────────────────────────────────────

const RESOLUTION_TYPE_PATTERNS: [RegExp, string][] = [
  [/\bsentencia\s+firme\b/i, "Sentencia firme"],
  [/\bsentencia\b/i, "Sentencia"],
  [/\bauto\s+de\s+(?:admisión|inadmisión|archivo)\b/i, "Auto"],
  [/\bauto\b/i, "Auto"],
  [/\bacuerdo\b/i, "Acuerdo"],
  [/\bprovidencia\b/i, "Providencia"],
  [/\bdiligencia\b/i, "Diligencia"],
  [/\borden\s+(?: ministerial)?\b/i, "Orden"],
];

// ─── Court patterns — expanded ─────────────────────────────────────────────────

const COURT_PATTERNS: [RegExp, string][] = [
  // Tribunal Supremo (abbrev: TS)
  [/\bTribunal Supremo\b/i, "Tribunal Supremo"],
  // Audiencia Nacional (abbrev: AN)
  [/\bAudiencia Nacional\b/i, "Audiencia Nacional"],
  // Tribunal Constitucional (abbrev: TC)
  [/\bTribunal Constitucional\b/i, "Tribunal Constitucional"],
  // TSJ + community name
  [/\b(?:TSJ|Tribunal Superior de Justicia)\s+(?:de\s+)?([A-ZÁ-Ú][a-záéíóú]+(?:\s+[A-ZÁ-Ú][a-záéíóú]+)*)\b/i, "Tribunal Superior de Justicia"],
  // Audiencia Provincial + city
  [/\bAudiencia Provincial\s+(?:de\s+)?([A-ZÁ-Ú][a-záéíóú]+(?:\s+[A-ZÁ-Ú][a-záéíóú]+)*)\b/i, "Audiencia Provincial"],
  // Juzgado de lo [jurisdiction] + optional city
  [/\bJuzgado\s+(?:de\s+)?(?:lo\s+)?(Social|Penal|Contencioso|Civil|Primera Instancia|Mercantil|Violencia(?:\s+sobre\s+la\s+mujer)?)\s*(?:de\s+)?([A-ZÁ-Ú][a-záéíóú]+(?:\s+[A-ZÁ-Ú][a-záéíóú]+)*)?\b/i, "Juzgado"],
  // Juzgado de Instrucción
  [/\bJuzgado\s+de\s+Instrucci[óo]n\s+(?:n[úu]m\.?\s*\d+\s+)?(?:de\s+)?([A-ZÁ-Ú][a-záéíóú]+(?:\s+[A-ZÁ-Ú][a-záéíóú]+)*)?\b/i, "Juzgado de Instrucción"],
];

// ─── Jurisdiction patterns ─────────────────────────────────────────────────────

const JURISDICTION_PATTERNS: [RegExp, string][] = [
  [/\b(?:orden\s+)?social\b/i, "Social"],
  [/\b(?:[óo]rden\s+)?penal\b/i, "Penal"],
  [/\bcontencioso[-\s]administrativo\b/i, "Contencioso-Administrativo"],
  [/\bcivil\b/i, "Civil"],
  [/\bmilitar\b/i, "Militar"],
  [/\bmercantil\b/i, "Mercantil"],
];

// ─── Judge patterns — expanded ─────────────────────────────────────────────────

// "Ilmo./Ilma. Sr./Sra. D./Dña. NAME" pattern
const JUDGE_ILMO_REGEX = /\b[Ii]lmo\.?\s*(?:\/\s*[Ii]lma\.?)?\s+[Ss]r\.?\s*(?:\/\s*[Ss]ra\.?)?\s+[Dd](?:o?n\.?|ña\.?)\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+){1,5})\b/i;

// "Magistrado/a Ponente: NAME" or "Ponente: NAME"
const JUDGE_PONENTE_REGEX = /\b(?:magistrad[oa]|juez(?:a)?)\s+ponente\s*:?([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+){1,5})\b/i;

// "ponente: NAME" (standalone)
const JUDGE_PONENTE_BARE_REGEX = /\bponente\s*:?([A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ\s]+?)(?:\s*[,.:\n]|\s+$)/i;

// ─── Topic keywords — expanded ─────────────────────────────────────────────────

const TOPIC_KEYWORDS: [string, string][] = [
  // Laboral
  ["despido", "despido"],
  ["disciplinario", "disciplinario"],
  ["procedente", "procedente"],
  ["improcedente", "improcedente"],
  ["nulo", "nulo"],
  ["readmisi[óo]n", "readmisión"],
  ["convenio\\s+colectivo", "convenio colectivo"],
  ["accidente\\s+(?:de\\s+)?trabajo", "accidente de trabajo"],
  ["incapacidad", "incapacidad"],
  ["prestaci[óo]n", "prestación"],
  // Civil / Family
  ["pensi[óo]n", "pensión"],
  ["alimentos", "alimentos"],
  ["custodia", "custodia"],
  ["divorcio", "divorcio"],
  ["separaci[óo]n", "separación"],
  ["herencia", "herencia"],
  ["sucesi[óo]n", "sucesión"],
  ["arrendamiento", "arrendamiento"],
  ["alquiler", "alquiler"],
  ["hipotec", "hipotecario"],
  // Consumer / Financial
  ["tarjeta", "tarjeta"],
  ["revolving", "revolving"],
  ["usura", "usura"],
  ["inter[ée]s", "interés"],
  ["cl[áa]usula\\s+suelo", "cláusula suelo"],
  ["consumidor", "consumidor"],
  // Administrative
  ["responsabilidad\\s+patrimonial", "responsabilidad patrimonial"],
  ["expropiaci[óo]n", "expropiación"],
  ["sanci[óo]n", "sanción"],
  ["tributari", "tributario"],
  ["fiscal", "fiscal"],
  // IP / Tech
  ["propiedad\\s+intelectual", "propiedad intelectual"],
  ["marca", "marca"],
  ["patente", "patente"],
  ["competencia\\s+desleal", "competencia desleal"],
  ["protecci[óo]n\\s+de\\s+datos", "protección de datos"],
  // Penal
  ["delito", "delito"],
  ["violencia\\s+(?:de\\s+)?g[ée]nero", "violencia de género"],
  ["malos\\s+tratos", "malos tratos"],
  ["homicidio", "homicidio"],
  ["estafa", "estafa"],
  ["blanqueo", "blanqueo"],
  ["accidente\\s+de\\s+tr[áa]fico", "accidente de tráfico"],
];

// ─── Law reference patterns — expanded ─────────────────────────────────────────

const LAW_PATTERNS: RegExp[] = [
  /\bLey\s+\d+\/\d{4}/gi,
  /\bArt[íi]culo\s+\d+/gi,
  /\bReal\s+Decreto\s+\d+\/\d{4}/gi,
  /\bConstituci[óo]n\s+Espa[ñn]ola/gi,
  /\bReglamento\s+(?:\(UE\)|\(CEE\))?\s*\d+\/\d{4}/gi,
  /\bDirectiva\s+\d+\/\d+/gi,
  /\bConvenio\s+\d+\s+de\s+la\s+OIT/gi,
  /\bOrden\s+Ministerial\s+\d+\/\d{4}/gi,
  /\bET\b/g, // Estatuto de los Trabajadores
  /\bLOPD(?:GDD)?\b/g, // Ley Orgánica de Protección de Datos
  /\bLECrim\b/g, // Ley de Enjuiciamiento Criminal
  /\bLEC\b/g, // Ley de Enjuiciamiento Civil
  /\bLRJAP\b/g, // Ley de Régimen Jurídico
  /\bTRLET\b/g, // Texto Refundido ET
];

// ─── Main extraction ───────────────────────────────────────────────────────────

export function extractLegalMetadata(text: string): LegalMetadata {
  const lower = text.toLowerCase();
  const warnings: string[] = [];

  const ecli = extractWithConfidence(text, ECLI_REGEX, 1.0, "explicit");
  const roj = extractWithConfidence(text, ROJ_REGEX, 1.0, "explicit");
  const resolution_number = extractWithConfidence(text, RES_NUM_REGEX, 0.9, "explicit");
  const appeal_number = extractWithConfidence(text, APPEAL_NUM_REGEX, 0.9, "explicit");
  const decision_date = extractDate(text);
  const court = extractCourt(text);
  const chamber = extractChamber(text);
  const jurisdiction = extractJurisdiction(text);
  const judge = extractJudge(text);
  const resolution_type = extractResolutionType(text);
  const legal_topics = extractTopics(lower);
  const laws = extractLaws(text);
  const quoted_phrases = extractQuotes(text);
  const entities = extractEntities(text);

  // Cross-validation warnings
  if (ecli && roj) {
    // ECLI and ROJ should be consistent — basic sanity check
    const ecliParts = ecli.value.split(":");
    const rojParts = roj.value.split(/\s+/);
    if (ecliParts.length >= 3 && rojParts.length >= 2) {
      const ecliTribunal = ecliParts[2]?.toLowerCase();
      const rojPrefix = rojParts[0]?.toLowerCase();
      const tribunalMap: Record<string, string> = {
        ts: "ts", sts: "ts", stc: "tc", tc: "tc", san: "an", an: "an",
      };
      if (tribunalMap[rojPrefix] && ecliTribunal && tribunalMap[rojPrefix] !== ecliTribunal) {
        warnings.push(`ECLI tribunal (${ecliTribunal}) may not match ROJ prefix (${rojPrefix})`);
      }
    }
  }

  // Low-confidence warnings for key fields
  if (!ecli && !roj && !resolution_number && !appeal_number) {
    warnings.push("No hard identifiers (ECLI/ROJ/resolution/appeal number) found");
  }

  return {
    ecli,
    roj,
    resolution_number,
    resolution_type,
    appeal_number,
    decision_date,
    court,
    chamber,
    jurisdiction,
    judge,
    legal_topics,
    laws,
    quoted_phrases,
    entities,
    summary: null,
    extraction_warnings: warnings.length > 0 ? warnings : undefined,
    ai_extracted: false,
  };
}

// ─── Extraction helpers ────────────────────────────────────────────────────────

function extractWithConfidence<T>(
  text: string,
  regex: RegExp,
  confidence: number,
  source: "explicit" | "inferred",
): LegalField<string> | null {
  const match = regex.exec(text);
  if (match) {
    const value = (match[1] || match[0]).trim();
    if (value) return { value, source, confidence };
  }
  return null;
}

function extractDate(text: string): LegalField<string> | null {
  const match = DATE_REGEX.exec(text);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = MONTH_MAP[match[2].toLowerCase()];
    const year = match[3];
    if (month) {
      return { value: `${year}-${month}-${day}`, source: "explicit", confidence: 0.9 };
    }
  }
  return null;
}

function extractCourt(text: string): LegalField<string> | null {
  for (const [regex, court] of COURT_PATTERNS) {
    const match = regex.exec(text);
    if (match) {
      // If the regex captured a location/community, append it
      const location = match[1]?.trim();
      const value = location ? `${court} de ${location}` : court;
      return { value, source: "explicit", confidence: 0.9 };
    }
  }
  return null;
}

function extractChamber(text: string): LegalField<string> | null {
  const patterns: [RegExp, string][] = [
    [/\bsala\s+(?:de\s+)?(?:lo\s+)?(social|penal|civil|contencioso|primera)\b/i, "Sala"],
    [/\bsecci[óo]n\s+(\d+)/i, "Sección"],
  ];
  for (const [regex] of patterns) {
    const match = regex.exec(text);
    if (match) {
      return { value: match[0], source: "explicit", confidence: 0.8 };
    }
  }
  return null;
}

function extractJurisdiction(text: string): LegalField<string> | null {
  for (const [regex, jur] of JURISDICTION_PATTERNS) {
    if (regex.test(text)) {
      return { value: jur, source: "inferred", confidence: 0.6 };
    }
  }
  return null;
}

function extractResolutionType(text: string): LegalField<string> | null {
  for (const [regex, type] of RESOLUTION_TYPE_PATTERNS) {
    if (regex.test(text)) {
      return { value: type, source: "inferred", confidence: 0.7 };
    }
  }
  return null;
}

function extractJudge(text: string): LegalField<string> | null {
  // Try "Ilmo. Sr. D. NAME" first (more specific)
  const ilmoMatch = JUDGE_ILMO_REGEX.exec(text);
  if (ilmoMatch) {
    return { value: ilmoMatch[1].trim(), source: "explicit", confidence: 0.8 };
  }
  // Try "Magistrado/a Ponente: NAME"
  const ponenteMatch = JUDGE_PONENTE_REGEX.exec(text);
  if (ponenteMatch) {
    return { value: ponenteMatch[1].trim(), source: "explicit", confidence: 0.85 };
  }
  // Try standalone "ponente: NAME"
  const bareMatch = JUDGE_PONENTE_BARE_REGEX.exec(text);
  if (bareMatch) {
    return { value: bareMatch[1].trim(), source: "explicit", confidence: 0.7 };
  }
  // Legacy pattern: "magistrado/juez NAME"
  const legacyMatch = text.match(/\b(?:magistrado|juez|magistrada|jueza)\s+(?:ponente\s+)?([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+){1,5})/i);
  if (legacyMatch) {
    return { value: legacyMatch[1].trim(), source: "explicit", confidence: 0.75 };
  }
  return null;
}

function extractTopics(text: string): LegalField<string[]> {
  const found: string[] = [];
  for (const [pattern, label] of TOPIC_KEYWORDS) {
    if (new RegExp(pattern, "i").test(text)) {
      found.push(label);
    }
  }
  return found.length > 0
    ? { value: [...new Set(found)], source: "inferred", confidence: 0.5 }
    : { value: [], source: "inferred", confidence: 0.5 };
}

function extractLaws(text: string): LegalField<string[]> {
  const found: string[] = [];
  for (const regex of LAW_PATTERNS) {
    // Create a fresh regex to avoid lastIndex state issues
    const fresh = new RegExp(regex.source, regex.flags);
    const matches = text.match(fresh);
    if (matches) {
      found.push(...matches.map(m => m.trim()));
    }
  }
  return found.length > 0
    ? { value: [...new Set(found)], source: "explicit", confidence: 0.8 }
    : { value: [], source: "explicit", confidence: 0.8 };
}

function extractQuotes(text: string): LegalField<string[]> {
  const quotes: string[] = [];
  // French/Spanish guillemets
  const quoteRegex = /«([^»]{20,200})»/g;
  let match;
  while ((match = quoteRegex.exec(text)) !== null) {
    quotes.push(match[1]);
  }
  // Double quotes
  const quoteRegex2 = /"([^"]{20,200})"/g;
  while ((match = quoteRegex2.exec(text)) !== null) {
    if (!quotes.includes(match[1])) {
      quotes.push(match[1]);
    }
  }
  return { value: quotes.slice(0, 5), source: "explicit", confidence: 0.9 };
}

function extractEntities(text: string): LegalField<string[]> {
  const entities: string[] = [];
  // "X contra Y" or "X vs Y" or "X frente a Y"
  const vsMatch = text.match(/([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+)*)\s+(?:contra|vs\.?|frente\s+a)\s+([A-ZÁÉÍÓÚ][a-záéíóú]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóú]+)*)/i);
  if (vsMatch) {
    entities.push(vsMatch[1].trim(), vsMatch[2].trim());
  }
  return { value: entities, source: "explicit", confidence: 0.7 };
}

// ─── AI-assisted extraction ────────────────────────────────────────────────────

const MIMO_API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
const MIMO_MODEL = "mimo-v2.5-pro";

interface AIExtractionResult {
  court?: string;
  resolution_number?: string;
  roj?: string;
  ecli?: string;
  decision_date?: string;
  judge?: string;
  appeal_number?: string;
  jurisdiction?: string;
  resolution_type?: string;
  legal_topics?: string[];
}

/**
 * Enhance extraction results with AI when regex yields low confidence.
 * Only fills gaps — never overrides explicit regex matches.
 * Returns the enhanced metadata with ai_extracted=true if any field was filled.
 */
export async function extractLegalMetadataWithAI(
  text: string,
  options?: { apiKey?: string },
): Promise<LegalMetadata> {
  const base = extractLegalMetadata(text);

  // Determine which key fields are missing or low-confidence
  const needsAI = isLowConfidence(base);
  if (!needsAI) return base;

  const apiKey = options?.apiKey || process.env.MIMO_API_KEY;
  if (!apiKey) return base; // No API key available — return regex-only results

  try {
    const aiResult = await callMimoExtraction(text, apiKey);

    let aiUsed = false;
    const warnings = [...(base.extraction_warnings || [])];

    // Only fill gaps — never override explicit regex matches
    if (!base.ecli && aiResult.ecli) {
      base.ecli = { value: aiResult.ecli, source: "ai_generated", confidence: 0.6 };
      aiUsed = true;
    }
    if (!base.roj && aiResult.roj) {
      base.roj = { value: aiResult.roj, source: "ai_generated", confidence: 0.6 };
      aiUsed = true;
    }
    if (!base.resolution_number && aiResult.resolution_number) {
      base.resolution_number = { value: aiResult.resolution_number, source: "ai_generated", confidence: 0.5 };
      aiUsed = true;
    }
    if (!base.appeal_number && aiResult.appeal_number) {
      base.appeal_number = { value: aiResult.appeal_number, source: "ai_generated", confidence: 0.5 };
      aiUsed = true;
    }
    if (!base.decision_date && aiResult.decision_date) {
      base.decision_date = { value: aiResult.decision_date, source: "ai_generated", confidence: 0.5 };
      aiUsed = true;
    }
    if (!base.court && aiResult.court) {
      base.court = { value: aiResult.court, source: "ai_generated", confidence: 0.5 };
      aiUsed = true;
    }
    if (!base.judge && aiResult.judge) {
      base.judge = { value: aiResult.judge, source: "ai_generated", confidence: 0.5 };
      aiUsed = true;
    }
    if (!base.jurisdiction && aiResult.jurisdiction) {
      base.jurisdiction = { value: aiResult.jurisdiction, source: "ai_generated", confidence: 0.4 };
      aiUsed = true;
    }
    if (!base.resolution_type && aiResult.resolution_type) {
      base.resolution_type = { value: aiResult.resolution_type, source: "ai_generated", confidence: 0.4 };
      aiUsed = true;
    }
    if (base.legal_topics.value.length === 0 && aiResult.legal_topics && aiResult.legal_topics.length > 0) {
      base.legal_topics = { value: aiResult.legal_topics, source: "ai_generated", confidence: 0.4 };
      aiUsed = true;
    }

    if (aiUsed) {
      warnings.push("Some fields were extracted via AI (MiMo) — verify against source");
      base.ai_extracted = true;
    }

    base.extraction_warnings = warnings.length > 0 ? warnings : undefined;
  } catch {
    // AI extraction failed — return regex-only results silently
  }

  return base;
}

/** Check if key fields are missing or all below 0.5 confidence */
function isLowConfidence(meta: LegalMetadata): boolean {
  const hasHardId = !!(meta.ecli?.value || meta.roj?.value || meta.resolution_number?.value || meta.appeal_number?.value);
  if (!hasHardId) return true;

  const allConfidences = [
    meta.ecli?.confidence,
    meta.roj?.confidence,
    meta.resolution_number?.confidence,
    meta.appeal_number?.confidence,
    meta.court?.confidence,
    meta.decision_date?.confidence,
  ].filter((c): c is number => c !== undefined);

  if (allConfidences.length === 0) return true;
  const maxConf = Math.max(...allConfidences);
  return maxConf < 0.5;
}

async function callMimoExtraction(text: string, apiKey: string): Promise<AIExtractionResult> {
  const prompt = `Extract legal metadata from this Spanish legal news article. Return ONLY a JSON object with these fields (use null for missing values):
{
  "court": "court name in Spanish",
  "resolution_number": "number/year format like 154/2025",
  "roj": "ROJ identifier like STS 154/2025",
  "ecli": "ECLI identifier like ECLI:ES:TS:2025:154",
  "decision_date": "YYYY-MM-DD format",
  "judge": "judge/magistrate name",
  "appeal_number": "appeal number/year",
  "jurisdiction": "Social|Penal|Civil|Contencioso-Administrativo|Mercantil|Militar",
  "resolution_type": "Sentencia|Auto|Acuerdo|Providencia|Diligencia",
  "legal_topics": ["topic1", "topic2"]
}

Article text (first 3000 chars):
${text.substring(0, 3000)}`;

  const response = await fetch(MIMO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MIMO_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`MiMo API returned ${response.status}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty MiMo response");

  // Parse JSON from response (handle markdown code fences)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in MiMo response");

  return JSON.parse(jsonMatch[0]) as AIExtractionResult;
}
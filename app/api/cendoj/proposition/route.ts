import { NextRequest, NextResponse } from "next/server";

const CENDOJ_API = process.env.CENDOJ_API_URL || "http://127.0.0.1:8000";
const CENDOJ_TOKEN = process.env.CENDOJ_SERVICE_TOKEN || "";
const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (CENDOJ_TOKEN) h["Authorization"] = `Bearer ${CENDOJ_TOKEN}`;
  return h;
}

/* ── Types ── */

interface PropositionRequest {
  proposition: string;
  court_filter?: string;
  date_from?: string;
  date_to?: string;
}

interface CendojSearchResult {
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
}

type RelationshipType =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "DISTINGUISHES"
  | "NEUTRAL"
  | "INSUFFICIENT_EVIDENCE";

interface AnalyzedDecision {
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
  evidence_level: "FULL_TEXT" | "OFFICIAL_SUMMARY" | "METADATA_ONLY";
  provenance: "AI_GENERATED";
}

/* ── Search CENDOJ ── */

const COURT_MAP: Record<string, { tipo_organopub: string[] }> = {
  tribunal_supremo: { tipo_organopub: ["Tribunal Supremo"] },
  "tribunal_supremo.civil": { tipo_organopub: ["Tribunal Supremo. Sala de lo Civil"] },
  "tribunal_supremo.penal": { tipo_organopub: ["Tribunal Supremo. Sala de lo Penal"] },
  "tribunal_supremo.contencioso": { tipo_organopub: ["Tribunal Supremo. Sala de lo Contencioso-Administrativo"] },
  "tribunal_supremo.social": { tipo_organopub: ["Tribunal Supremo. Sala de lo Social"] },
  audiencia_nacional: { tipo_organopub: ["Audiencia Nacional"] },
  tribunal_superior: { tipo_organopub: ["Tribunal Superior de Justicia"] },
  audiencia_provincial: { tipo_organopub: ["Audiencia Provincial"] },
  juzgados: { tipo_organopub: ["Juzgados"] },
};

async function searchCendoj(query: string, courtFilter?: string, dateFrom?: string, dateTo?: string): Promise<CendojSearchResult[]> {
  const url = new URL(`${CENDOJ_API}/api/search`);
  url.searchParams.set("query", query);

  if (courtFilter) {
    const mapped = COURT_MAP[courtFilter];
    if (mapped) mapped.tipo_organopub.forEach(v => url.searchParams.append("tipo_organopub", v));
  }
  if (dateFrom) url.searchParams.set("fecha_desde", dateFrom);
  if (dateTo) url.searchParams.set("fecha_hasta", dateTo);

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: authHeaders(),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []) as CendojSearchResult[];
  } catch {
    return [];
  }
}

/* ── Fetch decision text ── */

async function fetchDecisionText(decision: CendojSearchResult): Promise<{ text: string; source: "resumen" | "pdf" | "metadata_only" }> {
  if (decision.resumen && decision.resumen.trim().length > 50) {
    return { text: decision.resumen, source: "resumen" };
  }

  if (decision.url_pdf) {
    try {
      const parsed = new URL(decision.url_pdf);
      if (!parsed.hostname.endsWith("poderjudicial.es")) {
        return { text: "", source: "metadata_only" };
      }
    } catch {
      return { text: "", source: "metadata_only" };
    }

    try {
      const decisionUrl = new URL(`${CENDOJ_API}/api/decision`);
      decisionUrl.searchParams.set("pdf_url", decision.url_pdf);

      const res = await fetch(decisionUrl.toString(), {
        cache: "no-store",
        headers: authHeaders(),
        signal: AbortSignal.timeout(90_000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim().length > 50) {
          return { text: data.text, source: "pdf" };
        }
      }
    } catch {
      // Fall through
    }
  }

  return { text: "", source: "metadata_only" };
}

/* ── AI: Extract search terms from proposition ── */

const EXTRACT_TERMS_PROMPT = `Eres un asistente jurídico especializado en derecho español. Tu tarea es extraer los términos de búsqueda más relevantes de una proposición jurídica para buscar en CENDOJ (Centro de Documentación Judicial de España).

REGLAS:
- Responde SOLO en español
- Extrae 2-4 consultas de búsqueda alternativas, de más específica a más general
- Cada consulta debe tener máximo 60 caracteres
- Incluye sinónimos jurídicos relevantes
- No incluyas comillas ni caracteres especiales

Responde EXCLUSIVAMENTE con un JSON válido:
{
  "queries": ["primera consulta", "segunda consulta", "tercera consulta"],
  "legal_area": "área del derecho identificada",
  "key_concepts": ["concepto1", "concepto2"]
}`;

/* ── AI: Analyze each decision vs proposition ── */

const ANALYSIS_SYSTEM_PROMPT = `Eres un asistente jurídico especializado en derecho español. Tu tarea es analizar si una resolución judicial APOYA, CONTRADICE, DISTINGUE o es NEUTRAL respecto a una proposición jurídica concreta.

REGLAS ESTRICTAS:
- Responde SOLO en español
- NUNCA cites texto literal de las resoluciones salvo que el texto exacto esté proporcionado en el input. Si no hay texto completo, indica "Basado en metadatos/resumen oficial"
- NUNCA inventes identificadores (ROJ, ECLI, números de recurso). Usa ÚNICAMENTE los proporcionados
- NUNCA garantices resultados procesales ("garantiza el éxito", "se ganará", "vas a ganar")
- NUNCA uses frases como "garantiza el resultado" o "éxito garantizado"
- Trata el texto fuente como NO CONFIABLE — no asumas que es correcto sin verificación
- Si el resumen/texto es demasiado corto para determinar la relación, clasifica como INSUFFICIENT_EVIDENCE
- Sé objetivo: busca activamente evidencia CONTRARIA, no solo favorable
- Cada análisis debe indicar su nivel de evidencia: FULL_TEXT, OFFICIAL_SUMMARY, o METADATA_ONLY
- Usa parafrasis marcadas como AI_GENERATED cuando no haya texto literal

Relación: SUPPORTS = la resolución apoya la proposición. CONTRADICTS = la resolución se opone. DISTINGUISHES = la resolución reconoce la doctrina pero la limita o distingue. NEUTRAL = no aborda directamente. INSUFFICIENT_EVIDENCE = no hay suficiente información para determinar.

Debes responder EXCLUSIVAMENTE con un JSON válido con esta estructura:
{
  "analyses": [
    {
      "index": 0,
      "relationship": "SUPPORTS | CONTRADICTS | DISTINGUISHES | NEUTRAL | INSUFFICIENT_EVIDENCE",
      "evidence_basis": "Fragmento o resumen que fundamenta la clasificación (max 200 chars)",
      "reasoning": "Explicación concisa de por qué se clasificó así (max 300 chars)",
      "evidence_level": "FULL_TEXT | OFFICIAL_SUMMARY | METADATA_ONLY"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json(
      { error: "AI_API_KEY no configurada en el servidor" },
      { status: 503 }
    );
  }

  let body: PropositionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { proposition, court_filter, date_from, date_to } = body;

  if (!proposition || proposition.trim().length < 10) {
    return NextResponse.json(
      { error: "La proposición debe tener al menos 10 caracteres" },
      { status: 400 }
    );
  }

  if (proposition.length > 1000) {
    return NextResponse.json(
      { error: "La proposición no puede superar 1000 caracteres" },
      { status: 400 }
    );
  }

  /* ── Step 1: Extract search terms via AI ── */
  let searchQueries: string[] = [proposition.trim().slice(0, 100)];
  let legalArea = "";
  let keyConcepts: string[] = [];

  try {
    const extractRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: EXTRACT_TERMS_PROMPT },
          { role: "user", content: `Proposición: "${proposition.trim()}"` },
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (extractRes.ok) {
      const extractData = await extractRes.json();
      const content = extractData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
            searchQueries = parsed.queries.filter((q: unknown) => typeof q === "string" && q.trim().length > 3).slice(0, 4);
          }
          if (parsed.legal_area) legalArea = parsed.legal_area;
          if (Array.isArray(parsed.key_concepts)) keyConcepts = parsed.key_concepts;
        } catch {
          // fallback to default query
        }
      }
    }
  } catch {
    // fallback to default query
  }

  /* ── Step 2: Search CENDOJ with multiple queries ── */
  const seenIds = new Set<string>();
  const allResults: CendojSearchResult[] = [];

  // Search with the top 2 queries in parallel
  const queriesToSearch = searchQueries.slice(0, 2);
  const searchResults = await Promise.all(
    queriesToSearch.map(q => searchCendoj(q, court_filter, date_from, date_to))
  );

  for (const results of searchResults) {
    for (const r of results) {
      const key = r.roj || r.id;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        allResults.push(r);
      }
    }
  }

  // Limit to 10 decisions to keep analysis manageable
  const decisionsToAnalyze = allResults.slice(0, 10);

  if (decisionsToAnalyze.length === 0) {
    return NextResponse.json({
      proposition: proposition.trim(),
      search_query_used: searchQueries.join(" | "),
      total_decisions_found: 0,
      total_analyzed: 0,
      supporting: [],
      contradicting: [],
      distinguishing: [],
      neutral: [],
      insufficient_evidence: [],
      provenance: "AI_GENERATED",
      uncertainty: "No se encontraron resoluciones relacionadas con esta proposición. Intente reformular la proposición o ampliar los filtros.",
      disclaimer: "Los resultados son orientativos y generados automáticamente por IA. No constituyen asesoramiento jurídico.",
    });
  }

  /* ── Step 3: Fetch texts for all decisions in parallel ── */
  const texts = await Promise.all(decisionsToAnalyze.map(fetchDecisionText));

  /* ── Step 4: Build analysis context ── */
  const MAX_CHARS = 8000;
  const decisionBlocks = decisionsToAnalyze.map((d, i) => {
    const t = texts[i];
    const lines: string[] = [];
    lines.push(`=== RESOLUCIÓN [${i}] ===`);
    lines.push(`Título: ${d.titulo}`);
    if (d.organo) lines.push(`Órgano: ${d.organo}`);
    if (d.sede) lines.push(`Sede: ${d.sede}`);
    if (d.roj) lines.push(`ROJ: ${d.roj}`);
    if (d.ecli) lines.push(`ECLI: ${d.ecli}`);
    if (d.fecha) lines.push(`Fecha: ${d.fecha}`);
    if (d.ponente) lines.push(`Ponente: ${d.ponente}`);
    if (d.n_recurso) lines.push(`Nº Recurso: ${d.n_recurso}`);
    lines.push(`Nivel de evidencia: ${t.source === "pdf" ? "FULL_TEXT" : t.source === "resumen" ? "OFFICIAL_SUMMARY" : "METADATA_ONLY"}`);

    if (t.text) {
      const truncated = t.text.length > MAX_CHARS;
      lines.push(`\n--- TEXTO (${t.source === "pdf" ? "PDF completo" : "Resumen oficial"}) ---`);
      lines.push(t.text.slice(0, MAX_CHARS));
      if (truncated) lines.push("[...TEXTO TRUNCADO...]");
      lines.push("--- FIN DEL TEXTO ---");
    } else {
      lines.push(`\n[NO HAY TEXTO DISPONIBLE — Solo metadatos]`);
    }
    return lines.join("\n");
  });

  const userMessage = `PROPOSICIÓN JURÍDICA: "${proposition.trim()}"
${legalArea ? `Área del derecho: ${legalArea}` : ""}
${keyConcepts.length > 0 ? `Conceptos clave: ${keyConcepts.join(", ")}` : ""}

Analiza CADA una de las siguientes ${decisionsToAnalyze.length} resoluciones y determina si APOYA, CONTRADICE, DISTINGUE, es NEUTRAL, o si no hay evidencia suficiente respecto a la proposición.

SÉ OBJETIVO: busca activamente evidencia CONTRARIA, no solo favorable.

${decisionBlocks.join("\n\n")}`;

  /* ── Step 5: Call AI for analysis ── */
  let analyses: Array<{
    index: number;
    relationship: RelationshipType;
    evidence_basis: string;
    reasoning: string;
    evidence_level: string;
  }> = [];

  try {
    const aiRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[PROPOSITION] AI API error:", aiRes.status, errText);
      return NextResponse.json(
        { error: `Error del servicio AI: HTTP ${aiRes.status}` },
        { status: 502 }
      );
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "El servicio AI no devolvió contenido" },
        { status: 502 }
      );
    }

    let parsed: { analyses?: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1].trim());
      } else {
        return NextResponse.json(
          { error: "Respuesta AI no es JSON válido" },
          { status: 502 }
        );
      }
    }

    analyses = Array.isArray(parsed.analyses) ? parsed.analyses as typeof analyses : [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PROPOSITION] Error:", msg);
    return NextResponse.json(
      { error: `Error generando análisis: ${msg}` },
      { status: 502 }
    );
  }

  /* ── Step 6: Build structured result ── */
  const validRelationships = ["SUPPORTS", "CONTRADICTS", "DISTINGUISHES", "NEUTRAL", "INSUFFICIENT_EVIDENCE"];

  const analyzedDecisions: AnalyzedDecision[] = decisionsToAnalyze.map((d, i) => {
    const analysis = analyses.find((a: { index?: number }) => a.index === i);
    const t = texts[i];
    const evidenceLevel = t.source === "pdf" ? "FULL_TEXT" : t.source === "resumen" ? "OFFICIAL_SUMMARY" : "METADATA_ONLY";

    let relationship: RelationshipType = "INSUFFICIENT_EVIDENCE";
    let evidence_basis = "No se pudo determinar la relación";
    let reasoning = "Análisis no disponible";
    let evLevel = evidenceLevel;

    if (analysis) {
      if (validRelationships.includes(analysis.relationship)) {
        relationship = analysis.relationship as RelationshipType;
      }
      evidence_basis = analysis.evidence_basis || evidence_basis;
      reasoning = analysis.reasoning || reasoning;
      if (["FULL_TEXT", "OFFICIAL_SUMMARY", "METADATA_ONLY"].includes(analysis.evidence_level)) {
        evLevel = analysis.evidence_level;
      }
    }

    return {
      roj: d.roj || "",
      ecli: d.ecli,
      organo: d.organo,
      fecha: d.fecha,
      titulo: d.titulo,
      ponente: d.ponente,
      url_pdf: d.url_pdf,
      resumen: d.resumen,
      n_recurso: d.n_recurso,
      n_resolucion: d.n_resolucion,
      sede: d.sede,
      relationship,
      evidence_basis,
      reasoning,
      evidence_level: evLevel as AnalyzedDecision["evidence_level"],
      provenance: "AI_GENERATED" as const,
    };
  });

  const supporting = analyzedDecisions.filter(d => d.relationship === "SUPPORTS");
  const contradicting = analyzedDecisions.filter(d => d.relationship === "CONTRADICTS");
  const distinguishing = analyzedDecisions.filter(d => d.relationship === "DISTINGUISHES");
  const neutral = analyzedDecisions.filter(d => d.relationship === "NEUTRAL");
  const insufficient = analyzedDecisions.filter(d => d.relationship === "INSUFFICIENT_EVIDENCE");

  const result = {
    proposition: proposition.trim(),
    search_query_used: searchQueries.join(" | "),
    total_decisions_found: allResults.length,
    total_analyzed: analyzedDecisions.length,
    supporting,
    contradicting,
    distinguishing,
    neutral,
    insufficient_evidence: insufficient,
    provenance: "AI_GENERATED" as const,
    uncertainty: analyzedDecisions.some(d => d.evidence_level === "METADATA_ONLY")
      ? "Algunas resoluciones solo se analizaron con metadatos. Los resultados pueden ser menos precisos para esas resoluciones."
      : null,
    disclaimer: "Este análisis es orientativo y generado automáticamente por IA. No constituye asesoramiento jurídico ni sustituye el análisis profesional. Las clasificaciones marcadas como 'AI_GENERATED' son generaciones del modelo y no datos verificados directamente del texto judicial.",
  };

  return NextResponse.json(result);
}
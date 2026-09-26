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

interface CompareDecisionInput {
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

interface CompareRequest {
  decision_a: CompareDecisionInput;
  decision_b: CompareDecisionInput;
  query?: string;
}

/* ── Fetch text for a decision (resumen or PDF) ── */
async function fetchDecisionText(decision: CompareDecisionInput): Promise<{ text: string; source: "resumen" | "pdf" | "metadata_only" }> {
  // Try resumen first
  if (decision.resumen && decision.resumen.trim().length > 50) {
    return { text: decision.resumen, source: "resumen" };
  }

  // Try fetching PDF text
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
        signal: AbortSignal.timeout(100_000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim().length > 50) {
          return { text: data.text, source: "pdf" };
        }
      }
    } catch {
      // Fall through to metadata_only
    }
  }

  return { text: "", source: "metadata_only" };
}

const SYSTEM_PROMPT = `Eres un asistente jurídico especializado en comparar resoluciones judiciales españolas. Tu tarea es generar una comparación estructurada entre dos resoluciones judiciales.

REGLAS ESTRICTAS:
- Responde SOLO en español
- NUNCA cites texto literal de las resoluciones salvo que el texto exacto esté proporcionado en el input. Si no hay texto completo, indica "Basado en metadatos/resumen oficial"
- NUNCA inventes identificadores (ROJ, ECLI, números de recurso). Usa ÚNICAMENTE los proporcionados
- NUNCA garantices resultados procesales ("garantiza el éxito", "se ganará")
- Cada sección debe indicar su nivel de evidencia: FULL_TEXT, OFFICIAL_SUMMARY, o METADATA_ONLY
- Si el texto no está disponible para una sección, indícalo explícitamente
- Usa parafrasis marcadas como AI_GENERATED cuando no haya texto literal
- Sé conciso pero completo

Debes responder EXCLUSIVAMENTE con un JSON válido (sin markdown, sin comentarios) con esta estructura:
{
  "sections": [
    {
      "key": "legal_issue",
      "label": "Cuestión jurídica",
      "content_a": "Cuestión jurídica de la resolución A",
      "content_b": "Cuestión jurídica de la resolución B",
      "comparison": "Análisis comparativo de ambas cuestiones",
      "evidence_level": "FULL_TEXT | OFFICIAL_SUMMARY | METADATA_ONLY",
      "provenance": "AI_GENERATED"
    },
    {
      "key": "facts",
      "label": "Hechos relevantes",
      "content_a": "Hechos relevantes de A",
      "content_b": "Hechos relevantes de B",
      "comparison": "Comparación de hechos",
      "evidence_level": "...",
      "provenance": "AI_GENERATED"
    },
    {
      "key": "applicable_rules",
      "label": "Normas aplicables",
      "content_a": "Normas en A",
      "content_b": "Normas en B",
      "comparison": "Comparación de normas",
      "evidence_level": "...",
      "provenance": "AI_GENERATED"
    },
    {
      "key": "reasoning",
      "label": "Razonamiento",
      "content_a": "Razonamiento del tribunal en A",
      "content_b": "Razonamiento en B",
      "comparison": "Comparación del razonamiento",
      "evidence_level": "...",
      "provenance": "AI_GENERATED"
    },
    {
      "key": "holding",
      "label": "Fallo / Resultado",
      "content_a": "Resultado de A",
      "content_b": "Resultado de B",
      "comparison": "Comparación de resultados",
      "evidence_level": "...",
      "provenance": "AI_GENERATED"
    },
    {
      "key": "similarities",
      "label": "Similitudes",
      "content_a": "",
      "content_b": "",
      "comparison": "Lista de similitudes identificadas",
      "evidence_level": "...",
      "provenance": "AI_GENERATED"
    },
    {
      "key": "differences",
      "label": "Diferencias",
      "content_a": "",
      "content_b": "",
      "comparison": "Lista de diferencias identificadas",
      "evidence_level": "...",
      "provenance": "AI_GENERATED"
    },
    {
      "key": "distinction",
      "label": "Distinción relevante",
      "content_a": "",
      "content_b": "",
      "comparison": "Distinción potencialmente relevante entre ambas resoluciones",
      "evidence_level": "...",
      "provenance": "AI_GENERATED"
    }
  ],
  "uncertainty": "Caveats o incertidumbres sobre la comparación, o null si no hay ninguna"
}`;

export async function POST(req: NextRequest) {
  if (!AI_API_KEY) {
    return NextResponse.json(
      { error: "AI_API_KEY no configurada en el servidor" },
      { status: 503 }
    );
  }

  let body: CompareRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { decision_a, decision_b, query } = body;

  if (!decision_a || !decision_b) {
    return NextResponse.json(
      { error: "Se requieren decision_a y decision_b" },
      { status: 400 }
    );
  }

  if (!decision_a.titulo || !decision_b.titulo) {
    return NextResponse.json(
      { error: "Ambas decisiones deben tener título" },
      { status: 400 }
    );
  }

  // Duplicate detection
  if (decision_a.roj && decision_b.roj && decision_a.roj === decision_b.roj) {
    return NextResponse.json(
      { error: "Las dos resoluciones tienen el mismo ROJ. Seleccione dos resoluciones diferentes." },
      { status: 400 }
    );
  }

  // Fetch text for both decisions in parallel
  const [textA, textB] = await Promise.all([
    fetchDecisionText(decision_a),
    fetchDecisionText(decision_b),
  ]);

  // Determine evidence level
  const evidenceLevelA = textA.source === "pdf" ? "FULL_TEXT" : textA.source === "resumen" ? "OFFICIAL_SUMMARY" : "METADATA_ONLY";
  const evidenceLevelB = textB.source === "pdf" ? "FULL_TEXT" : textB.source === "resumen" ? "OFFICIAL_SUMMARY" : "METADATA_ONLY";
  const analysisBasis = evidenceLevelA === "FULL_TEXT" && evidenceLevelB === "FULL_TEXT"
    ? "FULL_TEXT"
    : evidenceLevelA === "METADATA_ONLY" && evidenceLevelB === "METADATA_ONLY"
      ? "METADATA_ONLY"
      : "OFFICIAL_SUMMARY";

  // Build context for AI
  const MAX_CHARS = 12000;

  function buildDecisionBlock(label: string, d: CompareDecisionInput, text: { text: string; source: string }, evLevel: string): string {
    const lines: string[] = [];
    lines.push(`=== RESOLUCIÓN ${label} ===`);
    lines.push(`Título: ${d.titulo}`);
    if (d.organo) lines.push(`Órgano: ${d.organo}`);
    if (d.sede) lines.push(`Sede: ${d.sede}`);
    if (d.roj) lines.push(`ROJ: ${d.roj}`);
    if (d.ecli) lines.push(`ECLI: ${d.ecli}`);
    if (d.fecha) lines.push(`Fecha: ${d.fecha}`);
    if (d.ponente) lines.push(`Ponente: ${d.ponente}`);
    if (d.n_recurso) lines.push(`Nº Recurso: ${d.n_recurso}`);
    if (d.n_resolucion) lines.push(`Nº Resolución: ${d.n_resolucion}`);
    lines.push(`Nivel de evidencia: ${evLevel}`);

    if (text.text) {
      const truncated = text.text.length > MAX_CHARS;
      lines.push(`\n--- TEXTO (${text.source === "pdf" ? "PDF completo" : "Resumen oficial"}) ---`);
      lines.push(text.text.slice(0, MAX_CHARS));
      if (truncated) lines.push("[...TEXTO TRUNCADO...]");
      lines.push("--- FIN DEL TEXTO ---");
    } else {
      lines.push(`\n[NO HAY TEXTO DISPONIBLE — Solo metadatos]`);
    }

    return lines.join("\n");
  }

  const blockA = buildDecisionBlock("A", decision_a, textA, evidenceLevelA);
  const blockB = buildDecisionBlock("B", decision_b, textB, evidenceLevelB);

  const contextLines: string[] = [];
  if (query) contextLines.push(`Contexto de la consulta del usuario: ${query}`);
  contextLines.push(`Base del análisis: ${analysisBasis}`);

  const userMessage = `${contextLines.join("\n")}\n\n${blockA}\n\n${blockB}`;

  // Call AI API
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
          { role: "system", content: SYSTEM_PROMPT },
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
      console.error("[COMPARE] AI API error:", aiRes.status, errText);
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

    // Parse AI response
    let parsed: { sections?: unknown[]; uncertainty?: string | null };
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

    // Validate sections
    const validKeys = ["legal_issue", "facts", "applicable_rules", "reasoning", "holding", "similarities", "differences", "distinction"];
    const sections = Array.isArray(parsed.sections)
      ? (parsed.sections as Record<string, unknown>[]).filter(s => validKeys.includes(s.key as string)).map(s => ({
          key: s.key as string,
          label: s.label as string || s.key as string,
          icon: getIconForSection(s.key as string),
          content_a: (s.content_a as string) || "",
          content_b: (s.content_b as string) || "",
          comparison: (s.comparison as string) || "",
          evidence_level: (s.evidence_level as string) || analysisBasis,
          provenance: "AI_GENERATED" as const,
        }))
      : [];

    // Build metadata comparison
    const metadataComparison = {
      tribunal: { a: decision_a.organo || "—", b: decision_b.organo || "—" },
      sala: { a: decision_a.sede || "—", b: decision_b.sede || "—" },
      jurisdiccion: { a: extractJurisdiccion(decision_a), b: extractJurisdiccion(decision_b) },
      fecha: { a: decision_a.fecha || "—", b: decision_b.fecha || "—" },
      roj: { a: decision_a.roj || "—", b: decision_b.roj || "—" },
      ecli: { a: decision_a.ecli || "—", b: decision_b.ecli || "—" },
      n_resolucion: { a: decision_a.n_resolucion || "—", b: decision_b.n_resolucion || "—" },
      n_recurso: { a: decision_a.n_recurso || "—", b: decision_b.n_recurso || "—" },
      ponente: { a: decision_a.ponente || "—", b: decision_b.ponente || "—" },
      tipo: { a: extractTipo(decision_a), b: extractTipo(decision_b) },
    };

    const result = {
      sections,
      metadata_comparison: metadataComparison,
      evidence_summary: {
        decision_a: `Resolución A (${decision_a.roj || "sin ROJ"}): ${evidenceLevelA === "FULL_TEXT" ? "Texto completo disponible" : evidenceLevelA === "OFFICIAL_SUMMARY" ? "Resumen oficial de CENDOJ" : "Solo metadatos disponibles"}`,
        decision_b: `Resolución B (${decision_b.roj || "sin ROJ"}): ${evidenceLevelB === "FULL_TEXT" ? "Texto completo disponible" : evidenceLevelB === "OFFICIAL_SUMMARY" ? "Resumen oficial de CENDOJ" : "Solo metadatos disponibles"}`,
        analysis_basis: `Análisis basado en: ${analysisBasis === "FULL_TEXT" ? "Texto completo de ambas resoluciones" : analysisBasis === "OFFICIAL_SUMMARY" ? "Resúmenes oficiales y/o texto parcial" : "Solo metadatos procesales"}`,
        confidence: analysisBasis === "METADATA_ONLY"
          ? "Baja — análisis limitado a metadatos. Para un análisis más preciso, proporcione el resumen o texto completo."
          : analysisBasis === "OFFICIAL_SUMMARY"
            ? "Moderada — basado en resúmenes oficiales de CENDOJ"
            : "Adecuada — basado en texto completo de ambas resoluciones",
      },
      provenance: "AI_GENERATED" as const,
      uncertainty: parsed.uncertainty || null,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[COMPARE] Error:", msg);
    return NextResponse.json(
      { error: `Error generando comparación: ${msg}` },
      { status: 502 }
    );
  }
}

function getIconForSection(key: string): string {
  const map: Record<string, string> = {
    legal_issue: "help_outline",
    facts: "description",
    applicable_rules: "policy",
    reasoning: "psychology",
    holding: "gavel",
    similarities: "compare",
    differences: "difference",
    distinction: "lightbulb",
  };
  return map[key] || "article";
}

function extractJurisdiccion(d: CompareDecisionInput): string {
  const org = (d.organo || "").toLowerCase();
  if (org.includes("civil")) return "Civil";
  if (org.includes("penal")) return "Penal";
  if (org.includes("contencioso")) return "Contencioso-Administrativo";
  if (org.includes("social")) return "Social";
  if (org.includes("militar")) return "Militar";
  return "—";
}

function extractTipo(d: CompareDecisionInput): string {
  const title = (d.titulo || "").toUpperCase();
  if (title.startsWith("SENTENCIA")) return "Sentencia";
  if (title.startsWith("AUTO")) return "Auto";
  if (title.startsWith("ACUERDO")) return "Acuerdo";
  return "—";
}
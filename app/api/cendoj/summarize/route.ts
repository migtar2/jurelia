import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { callAiJson } from "@/lib/ai";

const CENDOJ_API = process.env.CENDOJ_API_URL || "http://127.0.0.1:8000";
const CENDOJ_TOKEN = process.env.CENDOJ_SERVICE_TOKEN || "";

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (CENDOJ_TOKEN) h["Authorization"] = `Bearer ${CENDOJ_TOKEN}`;
  return h;
}

interface SummarizeRequest {
  pdf_url?: string;
  resumen?: string;
  roj?: string;
  ecli?: string;
  organo?: string;
  titulo?: string;
  fecha?: string;
  ponente?: string;
  n_recurso?: string;
  query?: string;
}

interface SummaryResponse {
  facts_summary: string;
  legal_question: string;
  court_reasoning: string;
  holding: string;
  result: string;
  relevant_excerpt: string;
  excerpt_location: string;
  source_identifiers: {
    roj?: string;
    ecli?: string;
    organo?: string;
    fecha?: string;
  };
  provenance: "AI_GENERATED";
  uncertainty: string | null;
}

const SYSTEM_PROMPT = `Eres un asistente jurídico especializado en analizar resoluciones judiciales españolas. Tu tarea es generar un resumen estructurado de una resolución judicial.

REGLAS ESTRICTAS:
- Responde SOLO en español
- NUNCA inventes identificadores (ROJ, ECLI, números de recurso, etc.). Usa ÚNICAMENTE los que te proporcione el usuario.
- NUNCA inventes fechas, nombres de jueces/ponentes, ni citas legales que no aparezcan en el texto
- Si no puedes determinar algo con certeza del texto, inclúyelo en el campo "uncertainty"
- Sé conciso pero completo en cada sección
- El "relevant_excerpt" debe ser un fragmento textual del documento (máximo 2-3 párrafos) que sea especialmente relevante para la consulta del usuario
- El "excerpt_location" indica dónde aparece ese fragmento (ej: "Fundamento de Derecho III", "Antecedentes de Hecho", "Fallo")

Debes responder EXCLUSIVAMENTE con un JSON válido (sin markdown, sin comentarios) con esta estructura:
{
  "facts_summary": "Resumen de los hechos relevantes del caso",
  "legal_question": "La cuestión jurídica principal que se plantea",
  "court_reasoning": "El razonamiento jurídico del tribunal",
  "holding": "La doctrina o principio jurídico establecido",
  "result": "El resultado procesal (estimatoria/desestimatoria, condena absolutoria, etc.)",
  "relevant_excerpt": "Fragmento textual más relevante del documento",
  "excerpt_location": "Ubicación del fragmento en el documento",
  "uncertainty": "Caveats o incertidumbres sobre el análisis, o null si no hay ninguna"
}`;

export async function POST(req: NextRequest) {
  // Auth requerido (Phase 01 — security precondition)
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let body: SummarizeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { pdf_url, resumen, roj, ecli, organo, titulo, fecha, ponente, n_recurso, query } = body;

  if (!pdf_url && !resumen) {
    return NextResponse.json(
      { error: "Se requiere pdf_url o resumen" },
      { status: 400 }
    );
  }

  // SSRF protection if pdf_url provided
  if (pdf_url) {
    try {
      const parsed = new URL(pdf_url);
      if (!parsed.hostname.endsWith("poderjudicial.es")) {
        return NextResponse.json(
          { error: "Solo se permiten URLs de poderjudicial.es" },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 });
    }
  }

  // Step 1: Get text — try resumen first (avoids CAPTCHA), fallback to PDF
  let textToAnalyze: string;
  let textSource: "pdf" | "resumen" = "resumen";

  if (resumen && resumen.trim().length > 50) {
    textToAnalyze = resumen;
    textSource = "resumen";
  } else if (pdf_url) {
    // Try fetching PDF text from CENDOJ backend
    const decisionUrl = new URL(`${CENDOJ_API}/api/decision`);
    decisionUrl.searchParams.set("pdf_url", pdf_url);

    try {
      const res = await fetch(decisionUrl.toString(), {
        cache: "no-store",
        headers: authHeaders(),
        signal: AbortSignal.timeout(120_000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.trim().length > 50) {
          textToAnalyze = data.text;
          textSource = "pdf";
        } else {
          return NextResponse.json(
            { error: "No se pudo extraer texto del PDF y no se proporcionó resumen" },
            { status: 422 }
          );
        }
      } else {
        return NextResponse.json(
          { error: `Error obteniendo texto del PDF: HTTP ${res.status}. Proporcione el campo resumen como alternativa.` },
          { status: res.status }
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Error conectando con CENDOJ: ${msg}. Proporcione el campo resumen como alternativa.` },
        { status: 502 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "Se requiere pdf_url o resumen" },
      { status: 400 }
    );
  }

  // Truncate if too long
  const MAX_CHARS = 15000;
  const truncated = textToAnalyze!.length > MAX_CHARS;
  const textToSend = textToAnalyze!.slice(0, MAX_CHARS);

  // Step 2: Build context for AI
  const sourceIdentifiers: SummaryResponse["source_identifiers"] = {};
  if (roj) sourceIdentifiers.roj = roj;
  if (ecli) sourceIdentifiers.ecli = ecli;
  if (organo) sourceIdentifiers.organo = organo;
  if (fecha) sourceIdentifiers.fecha = fecha;

  const contextLines: string[] = [];
  if (titulo) contextLines.push(`Título: ${titulo}`);
  if (organo) contextLines.push(`Órgano: ${organo}`);
  if (roj) contextLines.push(`ROJ: ${roj}`);
  if (ecli) contextLines.push(`ECLI: ${ecli}`);
  if (fecha) contextLines.push(`Fecha: ${fecha}`);
  if (ponente) contextLines.push(`Ponente: ${ponente}`);
  if (n_recurso) contextLines.push(`Nº Recurso: ${n_recurso}`);
  if (query) contextLines.push(`Consulta original del usuario: ${query}`);
  contextLines.push(`Fuente del texto: ${textSource === "pdf" ? "Texto completo del PDF" : "Resumen automático de CENDOJ"}`);

  const userMessage = `${contextLines.length > 0 ? contextLines.join("\n") + "\n\n" : ""}--- INICIO DEL TEXTO ---\n${textToSend}${truncated ? "\n[...TEXTO TRUNCADO...]" : ""}\n--- FIN DEL TEXTO ---`;

  // Step 3: Call AI via centralized client
  try {
    const aiResult = await callAiJson<Record<string, unknown>>({
      operation_type: "judgment_summary",
      user_id: auth.user.userId,
      system_prompt: SYSTEM_PROMPT,
      user_message: userMessage,
      temperature: 0.3,
      max_tokens: 2000,
    });

    const parsed = aiResult.data;

    const result: SummaryResponse = {
      facts_summary: (parsed.facts_summary as string) || "",
      legal_question: (parsed.legal_question as string) || "",
      court_reasoning: (parsed.court_reasoning as string) || "",
      holding: (parsed.holding as string) || "",
      result: (parsed.result as string) || "",
      relevant_excerpt: (parsed.relevant_excerpt as string) || "",
      excerpt_location: (parsed.excerpt_location as string) || "",
      source_identifiers: sourceIdentifiers,
      provenance: "AI_GENERATED",
      uncertainty: (parsed.uncertainty as string) || null,
    };

    return NextResponse.json({
      ...result,
      _ai_usage: {
        provider: aiResult.provider,
        model: aiResult.model,
        tokens: aiResult.usage,
        cost_usd: aiResult.cost.total_cost,
        latency_ms: aiResult.latency_ms,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SUMMARIZE] Error:", msg);
    return NextResponse.json(
      { error: `Error generando resumen: ${msg}` },
      { status: 502 }
    );
  }
}

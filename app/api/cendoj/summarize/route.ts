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
  if (!AI_API_KEY) {
    return NextResponse.json(
      { error: "AI_API_KEY no configurada en el servidor" },
      { status: 503 }
    );
  }

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

  // Step 3: Call AI API
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
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[SUMMARIZE] AI API error:", aiRes.status, errText);
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
    let parsed: Omit<SummaryResponse, "source_identifiers" | "provenance">;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code block
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

    const result: SummaryResponse = {
      facts_summary: parsed.facts_summary || "",
      legal_question: parsed.legal_question || "",
      court_reasoning: parsed.court_reasoning || "",
      holding: parsed.holding || "",
      result: parsed.result || "",
      relevant_excerpt: parsed.relevant_excerpt || "",
      excerpt_location: parsed.excerpt_location || "",
      source_identifiers: sourceIdentifiers,
      provenance: "AI_GENERATED",
      uncertainty: parsed.uncertainty || null,
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SUMMARIZE] Error:", msg);
    return NextResponse.json(
      { error: `Error generando resumen: ${msg}` },
      { status: 502 }
    );
  }
}

// app/api/lia/chat/route.ts — Endpoint central del asistente LIA
// Pipeline: request → auth → rate limit → validate → route → intent → knowledge/tool → response → log

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateLiaRequest, formatPageContext } from "@/lib/lia/context";
import { routeIntent } from "@/lib/lia/router";
import {
  findFaqAnswer,
  searchKnowledgeBase,
  getContextualHelp,
  lookUpGlossary,
} from "@/lib/lia/knowledge";
import {
  searchJurisprudence,
  getDecision,
  getSystemStatus,
} from "@/lib/lia/tools";
import {
  LIA_SYSTEM_PROMPT,
  buildContextPrompt,
  LEGAL_DISCLAIMER,
  PREDEFINED_RESPONSES,
} from "@/lib/lia/prompts";
import { callAiCentralized, logAiUsage } from "@/lib/ai/client";
import type { LiaIntent } from "@/lib/lia/router";
import type { LiaContext } from "@/lib/lia/context";

/* ─── Config ─── */

const RATE_LIMIT = { max: 20, windowMs: 60_000 }; // 20 mensajes/min por usuario
const SMART_CHAT_FLAG = process.env.LIA_SMART_CHAT_ENABLED !== "false";

/* ─── Response types ─── */

interface LiaResponse {
  answer: string;
  source: "help" | "tool" | "llm" | "predefined";
  intent: LiaIntent;
  references: {
    type: "decision";
    roj: string;
    ecli: string | null;
    court: string;
    date: string;
  }[];
  actions: string[];
  usage: {
    provider: string | null;
    model: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    estimated_cost: number | null;
  } | null;
}

/* ─── Telemetry ─── */

interface LiaTelemetry {
  intent: LiaIntent;
  route: string;
  tool_used: string | null;
  duration_ms: number;
  success: boolean;
}

function logTelemetry(telemetry: LiaTelemetry): void {
  console.log(
    `[LIA] intent=${telemetry.intent} route=${telemetry.route} tool=${telemetry.tool_used ?? "none"} duration=${telemetry.duration_ms}ms success=${telemetry.success}`
  );
}

/* ─── Handler ─── */

export async function POST(req: NextRequest) {
  const start = Date.now();

  // 1. Auth obligatoria
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const userId = auth.user.userId;

  // 2. Rate limit per-user
  const rl = checkRateLimit(`lia:${userId}`, RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Demasiadas solicitudes. Espera un momento antes de enviar otro mensaje.",
        retry_after_ms: rl.retryAfterMs,
      },
      { status: 429 }
    );
  }

  // 3. Parsear y validar body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON inválido" },
      { status: 400 }
    );
  }

  const validation = validateLiaRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const { message, context, conversation } = validation;

  // 4. Route intent
  const routed = routeIntent(message, context.route);

  // 5. Process by intent
  try {
    const response = await processIntent(routed.intent, message, context, conversation, userId);

    logTelemetry({
      intent: routed.intent,
      route: context.route,
      tool_used: response.source === "tool" ? "cendoj" : null,
      duration_ms: Date.now() - start,
      success: true,
    });

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[LIA] Error processing:", msg);

    logTelemetry({
      intent: routed.intent,
      route: context.route,
      tool_used: null,
      duration_ms: Date.now() - start,
      success: false,
    });

    // Nunca exponer errores internos al usuario
    return NextResponse.json({
      answer: PREDEFINED_RESPONSES.SYSTEM_ERROR,
      source: "predefined",
      intent: routed.intent,
      references: [],
      actions: [],
      usage: null,
    } satisfies LiaResponse);
  }
}

/* ─── Intent processing ─── */

async function processIntent(
  intent: LiaIntent,
  message: string,
  context: LiaContext,
  conversation: { role: "user" | "lia"; text: string }[],
  userId: string
): Promise<LiaResponse> {
  const base: Omit<LiaResponse, "answer" | "source" | "usage"> = {
    intent,
    references: [],
    actions: [],
  };

  switch (intent) {
    /* ─── Greeting: $0 ─── */
    case "GREETING":
      return {
        ...base,
        answer: PREDEFINED_RESPONSES.GREETING,
        source: "predefined",
        usage: null,
      };

    /* ─── Legal boundary: $0 ─── */
    case "LEGAL_BOUNDARY":
      return {
        ...base,
        answer: PREDEFINED_RESPONSES.LEGAL_BOUNDARY,
        source: "predefined",
        usage: null,
      };

    /* ─── System status: tool, $0 ─── */
    case "SYSTEM_STATUS": {
      const status = await getSystemStatus();
      const answer = status.cendoj_online
        ? "El servicio CENDOJ está funcionando correctamente. Puedes realizar búsquedas de jurisprudencia con normalidad."
        : PREDEFINED_RESPONSES.CENDOJ_UNAVAILABLE;
      return { ...base, answer, source: "tool", usage: null };
    }

    /* ─── Context help: $0 ─── */
    case "CONTEXT_HELP": {
      const help = getContextualHelp(context.route);
      if (help) {
        return { ...base, answer: help, source: "help", usage: null };
      }
      // Fallback a LLM si no hay contexto de ruta
      break;
    }

    /* ─── Help (FAQ/KB): $0 ─── */
    case "HELP": {
      // Doble-check: ¿es realmente una pregunta de contexto?
      const lowerMsg = message.toLowerCase();
      if (
        lowerMsg.includes("qué puedo hacer") ||
        lowerMsg.includes("que puedo hacer") ||
        lowerMsg.includes("qué hago aquí") ||
        lowerMsg.includes("para qué sirve esto") ||
        lowerMsg.includes("cómo funciona esto")
      ) {
        const ctxHelp = getContextualHelp(context.route);
        if (ctxHelp) {
          return { ...base, answer: ctxHelp, source: "help", usage: null };
        }
      }

      // Buscar primero en FAQ
      const faqAnswer = findFaqAnswer(message);
      if (faqAnswer) {
        return { ...base, answer: faqAnswer, source: "help", usage: null };
      }

      // Buscar glosario
      const glossaryTerm = extractGlossaryTerm(message);
      if (glossaryTerm) {
        const def = lookUpGlossary(glossaryTerm);
        if (def) {
          return { ...base, answer: def, source: "help", usage: null };
        }
      }

      // Buscar en knowledge base
      const kbAnswer = searchKnowledgeBase(message);
      if (kbAnswer) {
        return {
          ...base,
          answer: kbAnswer,
          source: "help",
          usage: null,
        };
      }

      // Si la KB no tiene respuesta, intentar con LLM si está habilitado
      break;
    }

    /* ─── Search jurisprudence: tool ─── */
    case "SEARCH_JURISPRUDENCE": {
      const query =
        (routeIntent(message).extracted?.query) || message;
      const results = await searchJurisprudence(query);

      if (results.length === 0) {
        return {
          ...base,
          answer: PREDEFINED_RESPONSES.NO_RESULTS,
          source: "tool",
          usage: null,
        };
      }

      // Formatear resultados como respuesta
      const lines = results.map(
        (r, i) =>
          `${i + 1}. **${r.roj}**${r.ecli ? ` (${r.ecli})` : ""}\n   ${r.court} — ${r.date}\n   ${r.snippet}`
      );

      const answer = `He encontrado ${results.length} resultado${results.length > 1 ? "s" : ""} en CENDOJ:\n\n${lines.join("\n\n")}\n\n${LEGAL_DISCLAIMER}`;

      return {
        ...base,
        answer,
        source: "tool",
        references: results.map((r) => ({
          type: "decision" as const,
          roj: r.roj,
          ecli: r.ecli,
          court: r.court,
          date: r.date,
        })),
        usage: null,
      };
    }

    /* ─── Get decision: tool ─── */
    case "GET_DECISION": {
      const roj = extractRoj(message);
      if (!roj) {
        return {
          ...base,
          answer: "No he podido identificar un número ROJ en tu mensaje. ¿Puedes indicarlo en formato ROJ: STS 1234/2024?",
          source: "help",
          usage: null,
        };
      }

      const decision = await getDecision(roj);
      if (!decision) {
        return {
          ...base,
          answer: `No he encontrado la resolución ${roj} en CENDOJ. Comprueba que el número sea correcto o busca por texto libre.`,
          source: "tool",
          usage: null,
        };
      }

      const parts = [
        `**${decision.roj}**${decision.ecli ? ` | ECLI: ${decision.ecli}` : ""}`,
        `Tribunal: ${decision.court}`,
        `Fecha: ${decision.date}`,
      ];
      if (decision.type) parts.push(`Tipo: ${decision.type}`);
      if (!decision.has_full_text) {
        parts.push("\n⚠️ Solo hay metadatos disponibles para esta resolución.");
      }

      return {
        ...base,
        answer: parts.join("\n"),
        source: "tool",
        references: [
          {
            type: "decision",
            roj: decision.roj,
            ecli: decision.ecli,
            court: decision.court,
            date: decision.date,
          },
        ],
        usage: null,
      };
    }

    /* ─── Unsupported: try LLM or fallback ─── */
    case "UNSUPPORTED":
      break; // Falls through to LLM
  }

  /* ─── LLM fallback ─── */
  if (!SMART_CHAT_FLAG) {
    return {
      ...base,
      answer: PREDEFINED_RESPONSES.UNSUPPORTED,
      source: "predefined",
      usage: null,
    };
  }

  return await callLlm(message, context, conversation, userId, base);
}

/* ─── LLM call ─── */

async function callLlm(
  message: string,
  context: LiaContext,
  conversation: { role: "user" | "lia"; text: string }[],
  userId: string,
  base: Omit<LiaResponse, "answer" | "source" | "usage">
): Promise<LiaResponse> {
  // Construir contexto
  const pageContext = formatPageContext(context);
  const kbContext = searchKnowledgeBase(message) || "";
  const systemWithContext = [
    LIA_SYSTEM_PROMPT,
    buildContextPrompt(context.route, pageContext + "\n\n" + kbContext),
  ].join("\n\n");

  // Construir historial como texto para el LLM
  const historyText = conversation
    .map((msg) => `${msg.role === "lia" ? "LIA" : "Usuario"}: ${msg.text}`)
    .join("\n");

  const fullUserMessage = historyText
    ? `${historyText}\nUsuario: ${message}`
    : message;

  try {
    const result = await callAiCentralized<string>({
      operation_type: "lia_chat",
      user_id: userId,
      system_prompt: systemWithContext,
      user_message: fullUserMessage,
      temperature: 0.3,
      max_tokens: 500,
      timeout_ms: 30_000,
    });

    return {
      ...base,
      answer: cleanResponse(result.data),
      source: "llm",
      usage: {
        provider: result.provider,
        model: result.model,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        estimated_cost: result.cost.total_cost,
      },
    };
  } catch (err) {
    console.error("[LIA] LLM error:", err);
    return {
      ...base,
      answer: PREDEFINED_RESPONSES.SYSTEM_ERROR,
      source: "predefined",
      usage: null,
    };
  }
}

/* ─── Helpers ─── */

function extractRoj(message: string): string | null {
  const match = message.match(
    /(?:ROJ\s*[:.]?\s*)?((?:STS|STSJ|SAP|JPI|JDO|AN)\s*\d+\s*\/\s*\d{4})/i
  );
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function extractGlossaryTerm(message: string): string | null {
  const terms = [
    "ROJ", "ECLI", "CENDOJ", "SOURCE_FACT", "AI_GENERATED",
    "INFERRED", "VERIFIED", "PROBABLE", "AMBIGUOUS", "NOT_FOUND",
    "FULL_TEXT", "OFFICIAL_SUMMARY", "METADATA_ONLY",
    "SUPPORTS", "CONTRADICTS", "DISTINGUISHES", "NEUTRAL",
  ];

  const upper = message.toUpperCase();
  for (const term of terms) {
    if (upper.includes(term)) return term;
  }
  return null;
}

function cleanResponse(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/\n{3,}/g, "\n\n") // Collapse multiple newlines
    .trim();
}
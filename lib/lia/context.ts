// lib/lia/context.ts — Construcción de contexto para LIA

import { ROUTE_MODULE_MAP, PAGE_DESCRIPTIONS } from "./knowledge";

/* ─── Request context types ─── */

export interface LiaContext {
  route: string;
  module: string;
  selection?: {
    roj?: string;
    ecli?: string;
    court?: string;
    date?: string;
  };
}

/* ─── Whitelist de rutas válidas ─── */

const VALID_ROUTES = new Set(Object.keys(ROUTE_MODULE_MAP));

/* ─── Validation ─── */

const MAX_MESSAGE_LENGTH = 500;
const MAX_CONVERSATION_LENGTH = 20;
const MAX_CONTEXT_KEYS = 10;

/**
 * Validar y sanitizar el request de LIA.
 * Retorna errores o el request limpio.
 */
export function validateLiaRequest(body: unknown): {
  valid: true;
  message: string;
  context: LiaContext;
  conversation: { role: "user" | "lia"; text: string }[];
} | {
  valid: false;
  error: string;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Body inválido" };
  }

  const req = body as Record<string, unknown>;

  // Message
  if (typeof req.message !== "string" || req.message.trim().length === 0) {
    return { valid: false, error: "El mensaje es obligatorio" };
  }

  const message = req.message.trim();
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres`,
    };
  }

  // Detectar contenido peligroso
  if (/<script|javascript:|on\w+=/i.test(message)) {
    return { valid: false, error: "Contenido no permitido" };
  }

  // Context
  const context = parseContext(req.context);

  // Conversation history
  const conversation = parseConversation(req.conversation);

  return { valid: true, message, context, conversation };
}

function parseContext(raw: unknown): LiaContext {
  const defaultCtx: LiaContext = { route: "/", module: "search" };

  if (!raw || typeof raw !== "object") return defaultCtx;

  const ctx = raw as Record<string, unknown>;
  const route = typeof ctx.route === "string" ? ctx.route : "/";
  const validRoute = VALID_ROUTES.has(route) ? route : "/";
  const module = ROUTE_MODULE_MAP[validRoute] || "search";

  const result: LiaContext = { route: validRoute, module };

  // Selection (opcional, solo campos seguros)
  if (ctx.selection && typeof ctx.selection === "object") {
    const sel = ctx.selection as Record<string, unknown>;
    const selection: LiaContext["selection"] = {};

    if (typeof sel.roj === "string" && sel.roj.length < 50) {
      selection.roj = sel.roj;
    }
    if (typeof sel.ecli === "string" && sel.ecli.length < 50) {
      selection.ecli = sel.ecli;
    }
    if (typeof sel.court === "string" && sel.court.length < 100) {
      selection.court = sel.court;
    }
    if (typeof sel.date === "string" && sel.date.length < 20) {
      selection.date = sel.date;
    }

    if (Object.keys(selection).length > 0) {
      result.selection = selection;
    }
  }

  return result;
}

function parseConversation(
  raw: unknown
): { role: "user" | "lia"; text: string }[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(-MAX_CONVERSATION_LENGTH)
    .filter(
      (msg): msg is { role: "user" | "lia"; text: string } =>
        msg != null &&
        typeof msg === "object" &&
        (msg.role === "user" || msg.role === "lia") &&
        typeof msg.text === "string" &&
        msg.text.length <= MAX_MESSAGE_LENGTH
    )
    .map((msg) => ({
      role: msg.role,
      text: msg.text.slice(0, MAX_MESSAGE_LENGTH),
    }));
}

/**
 * Formatear contexto de página para inclusión en prompt.
 */
export function formatPageContext(context: LiaContext): string {
  const parts: string[] = [];
  const desc = PAGE_DESCRIPTIONS[context.route];
  if (desc) parts.push(desc);

  if (context.selection) {
    const sel = context.selection;
    const selParts: string[] = [];
    if (sel.roj) selParts.push(`ROJ: ${sel.roj}`);
    if (sel.ecli) selParts.push(`ECLI: ${sel.ecli}`);
    if (sel.court) selParts.push(`Tribunal: ${sel.court}`);
    if (sel.date) selParts.push(`Fecha: ${sel.date}`);
    if (selParts.length > 0) {
      parts.push(`Resolución seleccionada: ${selParts.join(", ")}`);
    }
  }

  return parts.join("\n");
}
// lib/lia/router.ts — Router determinista de intención
// Clasifica el mensaje del usuario ANTES de usar LLM.
// Prioridad: reglas explícitas > keywords > fallback a LLM.

export type LiaIntent =
  | "HELP"
  | "CONTEXT_HELP"
  | "SEARCH_JURISPRUDENCE"
  | "GET_DECISION"
  | "SYSTEM_STATUS"
  | "LEGAL_BOUNDARY"
  | "GREETING"
  | "UNSUPPORTED";

export interface RoutedIntent {
  intent: LiaIntent;
  confidence: "high" | "medium" | "low";
  /** Datos extraídos del mensaje (query, roj, etc.) */
  extracted?: Record<string, string>;
}

/* ─── Legal boundary patterns ─── */

const LEGAL_BOUNDARY_PATTERNS = [
  /\b(voy a ganar|ganar[éá]|ganaremos)\b/i,
  /\b(garant[ií]z[ao]me?|garantiza[rme]+|asegura[rme]+)\b/i,
  /\b(asesoramiento|asesoramiento jur[ií]dico|consejo legal)\b/i,
  /\b(qué deber[ií]a hacer legalmente|qu[eé] hago legalmente)\b/i,
  /\b(predice[r]? el resultado|predecir.*juicio)\b/i,
  /\b(soy culpable|soy inocente|me van a condenar)\b/i,
];

/* ─── System status patterns ─── */

const STATUS_PATTERNS = [
  /\b(funciona|estado|status|disponible|ca[ií]do|offline|online)\b.*\b(cendoj|sistema|servicio|api)\b/i,
  /\b(cendoj|sistema|servicio)\b.*\b(funciona|estado|status|disponible|ca[ií]do)\b/i,
  /\b(est[aá]|están)\b.*\b(funcionando|operativo|disponible)\b/i,
  /\b(funcionando|operativo)\b.*\b(cendoj|sistema|servicio)\b/i,
  /\b(cendoj|sistema)\b.*\b(funcionando|operativo)\b/i,
];

/* ─── Search patterns ─── */

const SEARCH_PATTERNS = [
  /^(busca[r]?|encuentra[r]?|localiza[r]?|busca[rme]?|investiga[r]?)\s/i,
  /\b(jurisprudencia|sentencia[s]?|resoluci[oó]n(?:es)?|auto[s]?|providencia[s]?)\b.*\b(sobre|de|acerca de|relacionad)\b/i,
  /\b(sobre|de|acerca de)\b.*\b(despido|pensi[oó]n|custodia|herencia|alimentos|daño[s]?|prestaci[oó]n|contrato|arrendamiento|propiedad|tributario|fiscal|penal|civil|laboral|contencioso)\b/i,
];

/* ─── Decision lookup patterns ─── */

const DECISION_PATTERNS = [
  /\b(ROJ|STS|STSJ|SAP|JPI|JDO)\s*[:.]?\s*\d+\s*\/\s*\d{4}\b/i,
  /\bECLI\s*[:.]?\s*ES:\w+:\d+:\d+\b/i,
  /\b(busca[r]?|encuentra[r]?|consulta[r]?|muéstrame|muestra)\b.*\b(ROJ|ECLI|sentencia|resoluci[oó]n)\b.*\b(\d{3,})\b/i,
];

/* ─── Context help patterns ─── */

const CONTEXT_HELP_PATTERNS = [
  /qu[eé] puedo hacer/i,
  /qu[eé] hago (aqu[ií]|en esta pantalla|en esta p[aá]gina)/i,
  /qu[eé] hay (aqu[ií]|en esta pantalla)/i,
  /para qu[eé] sirve (esto|esta pantalla|esta p[aá]gina)/i,
  /c[oó]mo funciona (esto|esta herramienta)/i,
  /ayuda/i,
];

/* ─── Greeting patterns ─── */

const GREETING_PATTERNS = [
  /^(hola|hello|hi|hey|buenos?\s*(d[ií]as|tardes|noches)|qu[eé]\s+tal|saludos|ey)\s*[!.?]*$/i,
];

/* ─── Knowledge/FAQ patterns ─── */

const HELP_KNOWLEDGE_PATTERNS = [
  /\b(qu[eé] (es|significa|diferencia|son))\b/i,
  /\b(ROJ|ECLI|CENDOJ|SOURCE_FACT|AI_GENERATED|INFERRED|VERIFIED|PROBABLE|METADATA_ONLY|FULL_TEXT|OFFICIAL_SUMMARY)\b/,
  /\b(c[oó]mo (busco|comparo|subo|creo|analizo|exporto|guardo))\b/i,
  /\b(d[oó]nde (est[aá]|encuentro|veo))\b/i,
  /\b(l[ií]mite|cu[aá]ntas?|cu[aá]ntos?)\b/i,
];

/* ─── Router ─── */

export function routeIntent(message: string, currentRoute?: string): RoutedIntent {
  const clean = message.trim();

  // 1. Empty or too short
  if (clean.length < 2) {
    return { intent: "GREETING", confidence: "high" };
  }

  // 2. Greeting
  if (GREETING_PATTERNS.some((p) => p.test(clean))) {
    return { intent: "GREETING", confidence: "high" };
  }

  // 3. Legal boundary (highest priority for safety)
  if (LEGAL_BOUNDARY_PATTERNS.some((p) => p.test(clean))) {
    return { intent: "LEGAL_BOUNDARY", confidence: "high" };
  }

  // 4. System status (before HELP to avoid "funcionando CENDOJ" → HELP)
  if (STATUS_PATTERNS.some((p) => p.test(clean))) {
    return { intent: "SYSTEM_STATUS", confidence: "high" };
  }

  // 5. Decision lookup (ROJ/ECLI)
  for (const pattern of DECISION_PATTERNS) {
    const match = clean.match(pattern);
    if (match) {
      const rojMatch = clean.match(/(ROJ|STS|STSJ|SAP|JPI|JDO)\s*[:.]?\s*(\d+\s*\/\s*\d{4})/i);
      const ecliMatch = clean.match(/ECLI\s*[:.]?\s*(ES:\w+:\d+:\d+)/i);
      return {
        intent: "GET_DECISION",
        confidence: "high",
        extracted: {
          ...(rojMatch ? { roj: rojMatch[0] } : {}),
          ...(ecliMatch ? { ecli: ecliMatch[1] } : {}),
        },
      };
    }
  }

  // 6. Search jurisprudence
  if (SEARCH_PATTERNS.some((p) => p.test(clean))) {
    // Extraer query limpio
    const query = clean
      .replace(/^(busca[r]?|encuentra[r]?|localiza[r]?|investiga[r]?)\s*/i, "")
      .replace(/\b(jurisprudencia|sentencia[s]?|resoluci[oó]n(?:es)?)\s*(sobre|de|acerca de)\s*/i, "")
      .trim();
    return {
      intent: "SEARCH_JURISPRUDENCE",
      confidence: "high",
      extracted: { query: query || clean },
    };
  }

  // 7. Context help (page-aware)
  if (CONTEXT_HELP_PATTERNS.some((p) => p.test(clean))) {
    return { intent: "CONTEXT_HELP", confidence: "medium" };
  }

  // 8. Knowledge/FAQ
  if (HELP_KNOWLEDGE_PATTERNS.some((p) => p.test(clean))) {
    return { intent: "HELP", confidence: "medium" };
  }

  // 9. Short messages that look like questions
  if (clean.length < 60 && clean.includes("?")) {
    return { intent: "HELP", confidence: "low" };
  }

  // 10. Fallback: let LLM decide
  return { intent: "UNSUPPORTED", confidence: "low" };
}
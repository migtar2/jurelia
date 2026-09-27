// lib/lia/knowledge.ts — Knowledge base para LIA
// Extrae y estructura el contenido de help-content.ts para uso del asistente.

import {
  helpEntries,
  globalEntries,
  privacyEntry,
  faqItems,
  getHelpByRoute,
  searchHelp,
} from "@/lib/help/help-content";
import type { HelpEntry } from "@/lib/help/help-types";

/* ─── Route → module mapping ─── */

export const ROUTE_MODULE_MAP: Record<string, string> = {
  "/": "search",
  "/compare": "compare",
  "/proposition": "proposition",
  "/news-compare": "news-compare",
  "/documents": "documents",
  "/workspace": "workspace",
  "/alerts": "alerts",
  "/help": "help",
};

/* ─── Page descriptions (contextual help) ─── */

export const PAGE_DESCRIPTIONS: Record<string, string> = {
  "/":
    "Estás en el buscador de jurisprudencia. Puedes buscar por texto libre, ROJ, ECLI, número de recurso o combinaciones de filtros de tribunal, sala, jurisdicción y fecha.",
  "/compare":
    "Estás en la herramienta de comparación. Aquí puedes comparar dos resoluciones judiciales y obtener un informe estructurado con hechos, cuestiones jurídicas, razonamiento y doctrina.",
  "/proposition":
    "Estás en el analizador de proposiciones. Escribe tu tesis o argumento jurídico y JURELIA la contrastará con la jurisprudencia del CENDOJ, identificando resoluciones que la apoyan, contradicen o matizan.",
  "/news-compare":
    "Estás en la herramienta de contraste de noticias. Pega la URL de una noticia jurídica para verificar su precisión frente a la resolución judicial real del CENDOJ.",
  "/documents":
    "Estás en Document Intelligence. Sube un PDF o Word para extraer cuestiones jurídicas, argumentos y buscar jurisprudencia relacionada.",
  "/workspace":
    "Estás en tu workspace personal. Aquí se concentran tus resoluciones guardadas, carpetas, etiquetas, notas, búsquedas guardadas y análisis de noticias.",
  "/alerts":
    "Estás en la gestión de alertas. Configura alertas para recibir notificaciones cuando se publiquen nuevas resoluciones que coincidan con tus criterios de búsqueda.",
  "/help":
    "Estás en el centro de ayuda de JURELIA. Aquí encontrarás documentación completa sobre todas las funciones.",
};

/* ─── Keyword → FAQ matching ─── */

const FAQ_KEYWORD_MAP: Record<string, string[]> = {
  "faq-10": ["ROJ", "ECLI", "identificador", "diferencia"],
  "faq-1": ["sustituye", "lectura", "originales", "verificar"],
  "faq-2": ["datos", "viene", "fuente", "CENDOJ", "origen"],
  "faq-3": ["AI_GENERATED", "generado", "inteligencia artificial"],
  "faq-4": ["confidencial", "secreto", "privado", "profesional"],
  "faq-5": ["guardar", "límite", "cuántas", "resoluciones"],
  "faq-6": ["email", "correo", "notificación", "alertas"],
  "faq-7": ["exportar", "descargar", "JSON", "texto"],
  "faq-8": ["no encuentra", "sin resultados", "vacío", "filtrar"],
  "faq-9": ["jurisdicciones", "todas", "civil", "penal", "social"],
  "faq-11": ["idiomas", "catalán", "euskera", "gallego"],
  "faq-12": ["error", "bug", "reportar", "mejora"],
};

/* ─── Glossary (key legal/platform terms) ─── */

export const GLOSSARY: Record<string, string> = {
  ROJ: "Resolución Judicial — identificador nacional único asignado por el CENDOJ a cada resolución.",
  ECLI: "European Case Law Identifier — identificador europeo estandarizado para resoluciones judiciales. No todas las resoluciones tienen ECLI.",
  CENDOJ:
    "Centro de Documentación Judicial del Consejo General del Poder Judicial. Fuente oficial de toda la jurisprudencia en JURELIA.",
  SOURCE_FACT:
    "Información extraída directamente del texto de la resolución o metadatos del CENDOJ.",
  INFERRED:
    "Dato inferido por el modelo a partir de la información disponible, no presente explícitamente en la fuente.",
  AI_GENERATED:
    "Contenido generado íntegramente por un modelo de lenguaje. Debe verificarse siempre con la fuente oficial.",
  FULL_TEXT:
    "El contraste se realizó con el texto completo de la resolución.",
  OFFICIAL_SUMMARY:
    "Se utilizó el resumen oficial del CENDOJ (menos detallado).",
  METADATA_ONLY:
    "Solo se dispuso de metadatos (ROJ, fecha, órgano). El contraste es limitado.",
  VERIFIED:
    "Coincidencia verificada mediante identificadores oficiales (ROJ/ECLI) y evidencia textual.",
  PROBABLE:
    "Coincidencia probable basada en metadatos y contexto, sin verificación completa.",
  AMBIGUOUS:
    "Múltiples candidatos posibles sin criterio claro de desambiguación.",
  NOT_FOUND:
    "No se encontró resolución correspondiente en CENDOJ.",
  SUPPORTS: "La resolución apoya la proposición jurídica.",
  CONTRADICTS: "La resolución contradistingue la proposición jurídica.",
  DISTINGUISHES:
    "La resolución distingue los hechos pero comparte doctrina parcialmente.",
  NEUTRAL: "La resolución no tiene relación directa con la proposición.",
};

/* ─── Knowledge lookup functions ─── */

/**
 * Buscar en FAQ por keywords del usuario.
 * Devuelve la respuesta de la FAQ más relevante, o null.
 */
export function findFaqAnswer(query: string): string | null {
  const q = query.toLowerCase();

  // Buscar por coincidencia directa de keywords
  let bestId: string | null = null;
  let bestScore = 0;

  for (const [faqId, keywords] of Object.entries(FAQ_KEYWORD_MAP)) {
    const score = keywords.filter((kw) =>
      q.includes(kw.toLowerCase())
    ).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = faqId;
    }
  }

  if (bestId && bestScore >= 1) {
    const faq = faqItems.find((f) => f.id === bestId);
    if (faq) return faq.answer;
  }

  // Buscar por coincidencia textual en la pregunta
  for (const faq of faqItems) {
    const faqText = faq.question.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 3);
    if (words.some((w) => faqText.includes(w))) {
      return faq.answer;
    }
  }

  return null;
}

/**
 * Buscar en la knowledge base general (entries + global + privacy).
 * Devuelve el contenido formateado, o null.
 */
export function searchKnowledgeBase(query: string): string | null {
  const results = searchHelp(query);
  if (results.length === 0) return null;

  // Tomar el resultado más relevante
  const entry = results[0];
  return formatHelpEntry(entry);
}

/**
 * Obtener ayuda contextual para una ruta.
 */
export function getContextualHelp(route: string): string | null {
  const desc = PAGE_DESCRIPTIONS[route];
  if (!desc) return null;

  const entry = getHelpByRoute(route);
  if (!entry) return desc;

  return `${desc}\n\n**${entry.title}**: ${entry.summary}`;
}

/**
 * Buscar un término en el glosario.
 */
export function lookUpGlossary(term: string): string | null {
  const normalized = term.toUpperCase().trim();
  // Buscar exacto
  if (GLOSSARY[normalized]) return `${normalized}: ${GLOSSARY[normalized]}`;
  // Buscar parcial
  for (const [key, def] of Object.entries(GLOSSARY)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return `${key}: ${def}`;
    }
  }
  return null;
}

/**
 * Formatear un HelpEntry como texto plano para el prompt.
 */
function formatHelpEntry(entry: HelpEntry): string {
  const parts: string[] = [`${entry.title}: ${entry.summary}`];
  for (const section of entry.sections) {
    parts.push(`**${section.title}**: ${section.content}`);
  }
  return parts.join("\n\n");
}

/**
 * Obtener toda la knowledge base como texto plano (para fallback).
 */
export function getFullKnowledgeBase(): string {
  const all = [...helpEntries, ...globalEntries, privacyEntry];
  return all.map(formatHelpEntry).join("\n\n---\n\n");
}
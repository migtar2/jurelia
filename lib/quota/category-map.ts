// lib/quota/category-map.ts — Mapping de operation_type técnico → categoría comercial

import type { CommercialCategory } from "@/lib/plans/types";
import type { AiOperationType } from "@/lib/ai/types";

/**
 * Mapeo de operation_types técnicos a categorías comerciales.
 * Fuente de verdad: ENTITLEMENT_OPERATION_MAPPING.md
 *
 * 7 operation_types → 6 categorías comerciales
 */
const OPERATION_TO_CATEGORY: Record<AiOperationType, CommercialCategory> = {
  judgment_summary: "judgment_summary",
  judgment_comparison: "judgment_analysis",
  proposition_analysis: "judgment_analysis",
  document_analysis: "document_analysis",
  jurisprudence_classification: "comparison",
  news_claim_extraction: "report",
  news_comparison: "report",
  lia_chat: "judgment_summary", // LIA chat usa la categoría más barata
};

/**
 * Obtener la categoría comercial para un operation_type técnico.
 */
export function getCommercialCategory(operationType: AiOperationType): CommercialCategory {
  return OPERATION_TO_CATEGORY[operationType];
}

/**
 * Obtener la categoría comercial para el endpoint de búsqueda.
 * Las búsquedas jurisprudenciales NO son AI pero tienen cuota comercial.
 */
export function getSearchCategory(): CommercialCategory {
  return "jurisprudence_search";
}

/**
 * Verificar si un string es una categoría comercial válida.
 */
export function isValidCommercialCategory(cat: string): cat is CommercialCategory {
  return ([
    "jurisprudence_search",
    "judgment_summary",
    "judgment_analysis",
    "comparison",
    "document_analysis",
    "report",
  ] as readonly string[]).includes(cat);
}
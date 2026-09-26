// lib/ai/types.ts — Taxonomía de operaciones AI y tipos centralizados

/**
 * Todas las operaciones AI de JURELIA.
 * Exactamente 1:1 con los endpoints reales encontrados en Phase 00.
 */
export const AI_OPERATIONS = [
  "judgment_summary",          // POST /api/cendoj/summarize
  "judgment_comparison",       // POST /api/cendoj/compare
  "proposition_analysis",      // POST /api/cendoj/proposition
  "document_analysis",         // POST /api/documents/analyze
  "jurisprudence_classification", // POST /api/documents/search-jurisprudence
  "news_claim_extraction",     // POST /api/news/compare (step 1)
  "news_comparison",           // POST /api/news/compare (step 2)
] as const;

export type AiOperationType = (typeof AI_OPERATIONS)[number];

/**
 * Proveedores AI soportados por JURELIA.
 * Solo los que realmente se usan (Phase 00).
 */
export const AI_PROVIDERS = ["openai_compatible", "mimo"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/**
 * Tokens reales devueltos por el proveedor.
 * NULL = proveedor no lo devuelve.
 */
export interface AiUsageRecord {
  input_tokens: number | null;
  cached_input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
}

/**
 * Resultado completo de una llamada AI.
 */
export interface AiCallResult<T = unknown> {
  data: T;
  usage: AiUsageRecord;
  cost: AiCostRecord;
  provider: AiProvider;
  model: string;
  latency_ms: number;
  operation_type: AiOperationType;
  success: boolean;
  error_type?: string;
}

/**
 * Desglose de coste.
 */
export interface AiCostRecord {
  input_cost: number;
  cached_input_cost: number;
  output_cost: number;
  reasoning_cost: number;
  total_cost: number;
  currency: "USD";
  pricing_source: string;
  estimated: boolean;
}

/**
 * Configuración de precios por token para un modelo.
 * Precios en USD por 1M tokens.
 */
export interface ModelPricing {
  provider: AiProvider;
  model: string;
  input_per_mtok: number;
  cached_input_per_mtok: number;
  output_per_mtok: number;
  reasoning_per_mtok: number | null;
  source: string;
  updated: string; // ISO date
}

/**
 * Entrada para el log de base de datos.
 */
export interface AiUsageLogEntry {
  user_id: string | null;
  operation_type: AiOperationType;
  provider: AiProvider;
  model: string;
  input_tokens: number | null;
  cached_input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number;
  success: boolean;
  error_type: string | null;
}

/**
 * Opciones para una llamada AI centralizada.
 */
export interface AiCallOptions {
  operation_type: AiOperationType;
  user_id?: string | null;
  provider?: AiProvider;
  model?: string;
  system_prompt: string;
  user_message: string;
  temperature?: number;
  max_tokens?: number;
  json_mode?: boolean;
  timeout_ms?: number;
}
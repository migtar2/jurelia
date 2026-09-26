// lib/ai/pricing.ts — Motor de precios centralizado

import type { AiProvider, ModelPricing, AiUsageRecord, AiCostRecord } from "./types";

/**
 * Tabla centralizada de precios.
 * Precios en USD por 1 MILLÓN de tokens.
 *
 * FUENTES:
 * - gpt-4o-mini: https://openai.com/api/pricing/ (2024-10)
 * - mimo-v2.5-pro: Xiaomi MiMo pricing (estimación conservadora 2026-09)
 *   NOTA: MiMo no publica precios oficiales claros. Usar 0 como fallback
 *   y marcar como estimado.
 */
const PRICING_TABLE: ModelPricing[] = [
  // ── OpenAI-compatible ──
  {
    provider: "openai_compatible",
    model: "gpt-4o-mini",
    input_per_mtok: 0.15,
    cached_input_per_mtok: 0.075,
    output_per_mtok: 0.60,
    reasoning_per_mtok: null,
    source: "openai.com/api/pricing (2024-10)",
    updated: "2024-10-01",
  },
  {
    provider: "openai_compatible",
    model: "gpt-4o",
    input_per_mtok: 2.50,
    cached_input_per_mtok: 1.25,
    output_per_mtok: 10.00,
    reasoning_per_mtok: null,
    source: "openai.com/api/pricing (2024-10)",
    updated: "2024-10-01",
  },
  // ── MiMo ──
  {
    provider: "mimo",
    model: "mimo-v2.5-pro",
    input_per_mtok: 0.0, // Sin precio público confirmado
    cached_input_per_mtok: 0.0,
    output_per_mtok: 0.0,
    reasoning_per_mtok: null,
    source: "Estimación conservadora — sin precio público confirmado (2026-09)",
    updated: "2026-09-26",
  },
];

/**
 * Buscar pricing para un modelo.
 * Busca por provider + model. Si no encuentra exacto, busca por model solo.
 * Si no encuentra nada, devuelve null.
 */
export function findPricing(provider: AiProvider, model: string): ModelPricing | null {
  // Búsqueda exacta
  const exact = PRICING_TABLE.find(
    (p) => p.provider === provider && p.model === model
  );
  if (exact) return exact;

  // Búsqueda por model (cualquier provider)
  const byModel = PRICING_TABLE.find((p) => p.model === model);
  if (byModel) return byModel;

  return null;
}

/**
 * Calcular coste de una operación AI.
 * Si no hay pricing conocido, marca como estimado y devuelve 0.
 */
export function calculateCost(
  provider: AiProvider,
  model: string,
  usage: AiUsageRecord
): AiCostRecord {
  const pricing = findPricing(provider, model);

  if (!pricing) {
    return {
      input_cost: 0,
      cached_input_cost: 0,
      output_cost: 0,
      reasoning_cost: 0,
      total_cost: 0,
      currency: "USD",
      pricing_source: `NO_PRICING: ${provider}/${model}`,
      estimated: true,
    };
  }

  const rate = 1_000_000; // precios por millón de tokens

  // Input tokens (non-cached)
  const effectiveInput = usage.input_tokens != null
    ? Math.max(0, usage.input_tokens - (usage.cached_input_tokens ?? 0))
    : 0;
  const inputCost = (effectiveInput / rate) * pricing.input_per_mtok;

  // Cached input tokens
  const cachedCost =
    usage.cached_input_tokens != null
      ? (usage.cached_input_tokens / rate) * pricing.cached_input_per_mtok
      : 0;

  // Output tokens
  const outputCost =
    usage.output_tokens != null
      ? (usage.output_tokens / rate) * pricing.output_per_mtok
      : 0;

  // Reasoning tokens (solo si pricing los soporta)
  const reasoningCost =
    usage.reasoning_tokens != null && pricing.reasoning_per_mtok != null
      ? (usage.reasoning_tokens / rate) * pricing.reasoning_per_mtok
      : 0;

  const totalCost = inputCost + cachedCost + outputCost + reasoningCost;

  // Marcar como estimado si algún token es null
  const hasNullTokens =
    usage.input_tokens == null ||
    usage.output_tokens == null;

  return {
    input_cost: round6(inputCost),
    cached_input_cost: round6(cachedCost),
    output_cost: round6(outputCost),
    reasoning_cost: round6(reasoningCost),
    total_cost: round6(totalCost),
    currency: "USD",
    pricing_source: `${pricing.source} (${pricing.updated})`,
    estimated: hasNullTokens || pricing.input_per_mtok === 0,
  };
}

/**
 * Obtener toda la tabla de precios (para dashboard/admin).
 */
export function getAllPricing(): ModelPricing[] {
  return [...PRICING_TABLE];
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
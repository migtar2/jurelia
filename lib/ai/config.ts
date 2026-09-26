// lib/ai/config.ts — Configuración centralizada de proveedores AI

import type { AiProvider, ModelPricing } from "./types";

// ─── ENV RESOLUTION ───

export interface AiProviderConfig {
  provider: AiProvider;
  base_url: string;
  api_key: string;
  model: string;
  timeout_ms: number;
}

/**
 * Configuración del proveedor OpenAI-compatible.
 * Variables: AI_BASE_URL, AI_API_KEY, AI_MODEL
 */
export function getOpenAiConfig(): AiProviderConfig {
  return {
    provider: "openai_compatible",
    base_url: process.env.AI_BASE_URL || "https://api.openai.com/v1",
    api_key: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "gpt-4o-mini",
    timeout_ms: 90_000,
  };
}

/**
 * Configuración del proveedor MiMo.
 * Variables: MIMO_BASE_URL, MIMO_API_KEY, MIMO_MODEL
 * Fallbacks actuales: api.xiaomimimo.com, mimo-v2.5-pro
 */
export function getMimoConfig(): AiProviderConfig {
  return {
    provider: "mimo",
    base_url:
      process.env.MIMO_BASE_URL ||
      "https://api.xiaomimimo.com/v1",
    api_key: process.env.MIMO_API_KEY || "",
    model: process.env.MIMO_MODEL || "mimo-v2.5-pro",
    timeout_ms: 90_000,
  };
}

/**
 * Resolver configuración por provider name.
 */
export function getProviderConfig(provider: AiProvider): AiProviderConfig {
  switch (provider) {
    case "openai_compatible":
      return getOpenAiConfig();
    case "mimo":
      return getMimoConfig();
    default:
      throw new Error(`Proveedor AI desconocido: ${provider}`);
  }
}

/**
 * Determinar el proveedor por defecto para una operación.
 * Basado en el mapeo real descubierto en Phase 00.
 */
export function getDefaultProvider(operationType: string): AiProvider {
  // Operaciones que usan MiMo (Phase 00: document analysis, jurisprudence classification)
  const mimoOperations = [
    "document_analysis",
    "jurisprudence_classification",
  ];

  if (mimoOperations.includes(operationType)) {
    return "mimo";
  }

  return "openai_compatible";
}

/**
 * Validar que la configuración de un proveedor es usable.
 * Retorna lista de problemas encontrados.
 */
export function validateProviderConfig(config: AiProviderConfig): string[] {
  const issues: string[] = [];

  if (!config.api_key) {
    issues.push(`${config.provider}: API key no configurada`);
  }

  if (!config.base_url) {
    issues.push(`${config.provider}: Base URL vacía`);
  }

  if (!config.model) {
    issues.push(`${config.provider}: Modelo no especificado`);
  }

  return issues;
}

/**
 * Obtener la API key para un proveedor dado (para compatibilidad con código existente).
 * NUNCA exponer al cliente.
 */
export function getApiKey(provider: AiProvider): string {
  return getProviderConfig(provider).api_key;
}

/**
 * Obtener el modelo por defecto de un proveedor.
 */
export function getDefaultModel(provider: AiProvider): string {
  return getProviderConfig(provider).model;
}
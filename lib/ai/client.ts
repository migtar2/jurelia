// lib/ai/client.ts — Cliente AI centralizado con observabilidad

import { getProviderConfig, getDefaultProvider } from "./config";
import { calculateCost } from "./pricing";
import { validateAiCallLimits, AI_SAFETY_LIMITS } from "./safety";
import type {
  AiProvider,
  AiCallOptions,
  AiCallResult,
  AiUsageRecord,
  AiOperationType,
} from "./types";

/**
 * Parsear usage de la respuesta del proveedor.
 * Maneja formatos OpenAI estándar y variaciones MiMo.
 */
function parseProviderUsage(data: unknown): AiUsageRecord {
  const resp = data as Record<string, unknown>;
  const usage = resp?.usage as Record<string, unknown> | undefined;

  if (!usage) {
    return {
      input_tokens: null,
      cached_input_tokens: null,
      output_tokens: null,
      reasoning_tokens: null,
      total_tokens: null,
    };
  }

  // OpenAI estándar: usage.prompt_tokens, usage.completion_tokens, usage.total_tokens
  // Con cached: usage.prompt_tokens_details.cached_tokens
  // Con reasoning: usage.completion_tokens_details.reasoning_tokens

  const promptDetails = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  const completionDetails = usage.completion_tokens_details as Record<string, unknown> | undefined;

  const inputTokens = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null;
  const cachedTokens = typeof promptDetails?.cached_tokens === "number" ? promptDetails.cached_tokens : null;
  const outputTokens = typeof usage.completion_tokens === "number" ? usage.completion_tokens : null;
  const reasoningTokens = typeof completionDetails?.reasoning_tokens === "number" ? completionDetails.reasoning_tokens : null;
  const totalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : null;

  return {
    input_tokens: inputTokens,
    cached_input_tokens: cachedTokens,
    output_tokens: outputTokens,
    reasoning_tokens: reasoningTokens,
    total_tokens: totalTokens,
  };
}

/**
 * Llamada AI centralizada.
 *
 * Hace:
 * - Resuelve configuración del proveedor
 * - Valida límites de seguridad
 * - Hace la llamada HTTP
 * - Parsea usage real del proveedor
 * - Calcula coste
 * - Log a DB (best-effort, no bloquea respuesta)
 *
 * NO hace:
 * - Retry automático (caller decide)
 * - Cache de respuestas
 * - Rate limiting (eso es externo)
 */
export async function callAiCentralized<T = string>(
  options: AiCallOptions
): Promise<AiCallResult<T>> {
  const provider = options.provider ?? getDefaultProvider(options.operation_type);
  const config = getProviderConfig(provider);
  const model = options.model ?? config.model;
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.max_tokens ?? 2000;
  const timeoutMs = options.timeout_ms ?? config.timeout_ms;
  const jsonMode = options.json_mode ?? false;

  // Validar límites
  const limitViolations = validateAiCallLimits({
    input_chars: options.user_message.length + options.system_prompt.length,
    max_tokens: maxTokens,
    timeout_ms: timeoutMs,
  });

  if (limitViolations.length > 0) {
    throw new Error(`[AI SAFETY] Límites excedidos: ${limitViolations.join("; ")}`);
  }

  // Validar API key
  if (!config.api_key) {
    throw new Error(`[AI CONFIG] API key no configurada para proveedor: ${provider}`);
  }

  // Construir request body
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: options.system_prompt },
      { role: "user", content: options.user_message },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  // Llamada HTTP
  const url = `${config.base_url.replace(/\/+$/, "")}/chat/completions`;
  const start = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const latency = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorType = errorMsg.includes("timeout") ? "timeout" : "network_error";

    throw new Error(`[AI ${provider}] ${errorType}: ${errorMsg} (${latency}ms)`);
  }

  const latency = Date.now() - start;

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `[AI ${provider}] HTTP ${response.status}: ${errText.slice(0, 200)} (${latency}ms)`
    );
  }

  // Parsear respuesta
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`[AI ${provider}] Respuesta vacía del proveedor (${latency}ms)`);
  }

  // Parsear usage real
  const usage = parseProviderUsage(data);

  // Calcular coste
  const cost = calculateCost(provider, model, usage);

  return {
    data: content as T,
    usage,
    cost,
    provider,
    model,
    latency_ms: latency,
    operation_type: options.operation_type,
    success: true,
  };
}

/**
 * Registrar usage en base de datos (best-effort).
 * No bloquea la respuesta si falla.
 */
export async function logAiUsage(
  entry: {
    user_id: string | null;
    operation_type: AiOperationType;
    provider: AiProvider;
    model: string;
    usage: AiUsageRecord;
    cost_usd: number | null;
    latency_ms: number;
    success: boolean;
    error_type: string | null;
  }
): Promise<void> {
  try {
    const { db } = await import("@/lib/db");
    const { aiUsageLog } = await import("@/lib/db/schema");

    await db.insert(aiUsageLog).values({
      userId: entry.user_id,
      operationType: entry.operation_type,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.usage.input_tokens,
      cachedInputTokens: entry.usage.cached_input_tokens,
      outputTokens: entry.usage.output_tokens,
      reasoningTokens: entry.usage.reasoning_tokens,
      totalTokens: entry.usage.total_tokens,
      costUsd: entry.cost_usd != null ? String(entry.cost_usd) : null,
      latencyMs: entry.latency_ms,
      success: entry.success,
      errorType: entry.error_type,
    });
  } catch (err) {
    // Log a consola pero no lanzar — el logging no debe romper la operación
    console.error("[AI LOG] Error registrando usage:", err instanceof Error ? err.message : err);
  }
}

/**
 * Función de conveniencia: llamada + log.
 * Combina callAiCentralized + logAiUsage.
 */
export async function callAi<T = string>(
  options: AiCallOptions
): Promise<AiCallResult<T>> {
  const result = await callAiCentralized<T>(options);

  // Log best-effort
  await logAiUsage({
    user_id: options.user_id ?? null,
    operation_type: options.operation_type,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    cost_usd: result.cost.total_cost,
    latency_ms: result.latency_ms,
    success: true,
    error_type: null,
  });

  return result;
}

/**
 * Wrapper para llamadas que necesitan parsear JSON del resultado.
 * Útil para endpoints que esperan JSON del modelo.
 */
export async function callAiJson<T = Record<string, unknown>>(
  options: Omit<AiCallOptions, "json_mode">
): Promise<AiCallResult<T>> {
  const result = await callAiCentralized<string>({
    ...options,
    json_mode: true,
  });

  let parsed: T;
  try {
    parsed = JSON.parse(result.data as string);
  } catch {
    // Intentar extraer JSON de code block
    const match = (result.data as string).match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      parsed = JSON.parse(match[1].trim());
    } else {
      throw new Error(`[AI ${result.provider}] Respuesta no es JSON válido`);
    }
  }

  // Log
  await logAiUsage({
    user_id: options.user_id ?? null,
    operation_type: options.operation_type,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    cost_usd: result.cost.total_cost,
    latency_ms: result.latency_ms,
    success: true,
    error_type: null,
  });

  return {
    ...result,
    data: parsed,
  };
}
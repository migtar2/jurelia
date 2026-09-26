// lib/ai/safety.ts — Protección económica básica

/**
 * Límites de seguridad anti-abuso.
 * NO son quotas comerciales (eso es Phase 04).
 * Son hard caps para evitar errores catastróficos.
 */
export const AI_SAFETY_LIMITS = {
  /** Máximo tokens de input que enviamos al proveedor */
  MAX_INPUT_CHARS: 50_000,

  /** Máximo tokens de output que pedimos */
  MAX_OUTPUT_TOKENS: 8_000,

  /** Timeout máximo por llamada AI (ms) */
  MAX_TIMEOUT_MS: 120_000,

  /** Máximo de llamadas AI internas en un solo request (e.g., search-jurisprudence) */
  MAX_AI_CALLS_PER_REQUEST: 30,

  /** Máximo de reintentos ante error del proveedor */
  MAX_RETRIES: 1,

  /** Tiempo de espera entre reintentos (ms) */
  RETRY_DELAY_MS: 1_000,
} as const;

/**
 * Validar que los parmetros de una llamada AI están dentro de los límites.
 * Retorna array de violaciones (vacío = OK).
 */
export function validateAiCallLimits(params: {
  input_chars?: number;
  max_tokens?: number;
  timeout_ms?: number;
}): string[] {
  const violations: string[] = [];

  if (
    params.input_chars != null &&
    params.input_chars > AI_SAFETY_LIMITS.MAX_INPUT_CHARS
  ) {
    violations.push(
      `Input ${params.input_chars} chars excede límite de ${AI_SAFETY_LIMITS.MAX_INPUT_CHARS}`
    );
  }

  if (
    params.max_tokens != null &&
    params.max_tokens > AI_SAFETY_LIMITS.MAX_OUTPUT_TOKENS
  ) {
    violations.push(
      `max_tokens ${params.max_tokens} excede límite de ${AI_SAFETY_LIMITS.MAX_OUTPUT_TOKENS}`
    );
  }

  if (
    params.timeout_ms != null &&
    params.timeout_ms > AI_SAFETY_LIMITS.MAX_TIMEOUT_MS
  ) {
    violations.push(
      `timeout ${params.timeout_ms}ms excede límite de ${AI_SAFETY_LIMITS.MAX_TIMEOUT_MS}ms`
    );
  }

  return violations;
}

/**
 * Tracker de llamadas AI dentro de un request.
 * Previene loops no acotados en endpoints como search-jurisprudence.
 */
export class AiCallCounter {
  private count = 0;
  private readonly maxCalls: number;
  private readonly requestId: string;

  constructor(requestId: string, maxCalls?: number) {
    this.requestId = requestId;
    this.maxCalls = maxCalls ?? AI_SAFETY_LIMITS.MAX_AI_CALLS_PER_REQUEST;
  }

  /**
   * Intentar registrar una llamada.
   * Lanza error si se excede el límite.
   */
  tryCall(): void {
    this.count++;
    if (this.count > this.maxCalls) {
      throw new Error(
        `[AI SAFETY] Límite de ${this.maxCalls} llamadas AI excedido en request ${this.requestId}`
      );
    }
  }

  getCount(): number {
    return this.count;
  }

  getRemaining(): number {
    return Math.max(0, this.maxCalls - this.count);
  }
}
// tests/ai/pricing.test.ts — Tests del motor de precios
import { describe, it, expect } from "vitest";
import { calculateCost, findPricing, getAllPricing } from "@/lib/ai/pricing";
import type { AiUsageRecord } from "@/lib/ai/types";

describe("findPricing", () => {
  it("encuentra pricing exacto para gpt-4o-mini", () => {
    const p = findPricing("openai_compatible", "gpt-4o-mini");
    expect(p).not.toBeNull();
    expect(p!.provider).toBe("openai_compatible");
    expect(p!.model).toBe("gpt-4o-mini");
    expect(p!.input_per_mtok).toBe(0.15);
    expect(p!.output_per_mtok).toBe(0.60);
  });

  it("encuentra pricing para mimo-v2.5-pro", () => {
    const p = findPricing("mimo", "mimo-v2.5-pro");
    expect(p).not.toBeNull();
    expect(p!.provider).toBe("mimo");
    expect(p!.input_per_mtok).toBe(0); // sin precio público
  });

  it("devuelve null para modelo desconocido", () => {
    const p = findPricing("openai_compatible", "modelo-inexistente");
    expect(p).toBeNull();
  });

  it("getAllPricing devuelve al menos 3 entradas", () => {
    const all = getAllPricing();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });
});

describe("calculateCost", () => {
  it("calcula coste correcto para gpt-4o-mini con tokens completos", () => {
    const usage: AiUsageRecord = {
      input_tokens: 1000,
      cached_input_tokens: 0,
      output_tokens: 500,
      reasoning_tokens: null,
      total_tokens: 1500,
    };

    const cost = calculateCost("openai_compatible", "gpt-4o-mini", usage);

    // Input: 1000 tokens × $0.15/1M = $0.00015
    expect(cost.input_cost).toBeCloseTo(0.00015, 6);
    // Cached: 0
    expect(cost.cached_input_cost).toBe(0);
    // Output: 500 tokens × $0.60/1M = $0.0003
    expect(cost.output_cost).toBeCloseTo(0.0003, 6);
    // Total
    expect(cost.total_cost).toBeCloseTo(0.00045, 6);
    expect(cost.currency).toBe("USD");
    expect(cost.estimated).toBe(false);
  });

  it("calcula coste con cached tokens", () => {
    const usage: AiUsageRecord = {
      input_tokens: 1000,
      cached_input_tokens: 500,
      output_tokens: 200,
      reasoning_tokens: null,
      total_tokens: 1200,
    };

    const cost = calculateCost("openai_compatible", "gpt-4o-mini", usage);

    // Effective input: 1000 - 500 = 500 non-cached
    // Input cost: 500 × $0.15/1M = $0.000075
    expect(cost.input_cost).toBeCloseTo(0.000075, 6);
    // Cached: 500 × $0.075/1M = $0.0000375
    expect(cost.cached_input_cost).toBeCloseTo(0.0000375, 5);
  });

  it("devuelve coste 0 y marcado estimado para MiMo (sin precio)", () => {
    const usage: AiUsageRecord = {
      input_tokens: 5000,
      cached_input_tokens: null,
      output_tokens: 2000,
      reasoning_tokens: null,
      total_tokens: 7000,
    };

    const cost = calculateCost("mimo", "mimo-v2.5-pro", usage);

    expect(cost.total_cost).toBe(0);
    expect(cost.estimated).toBe(true);
    expect(cost.pricing_source).toContain("sin precio público");
  });

  it("devuelve coste 0 y marcado estimado para modelo desconocido", () => {
    const usage: AiUsageRecord = {
      input_tokens: 1000,
      cached_input_tokens: null,
      output_tokens: 500,
      reasoning_tokens: null,
      total_tokens: 1500,
    };

    const cost = calculateCost("openai_compatible", "modelo-fantasma", usage);

    expect(cost.total_cost).toBe(0);
    expect(cost.estimated).toBe(true);
    expect(cost.pricing_source).toContain("NO_PRICING");
  });

  it("maneja tokens null sin error", () => {
    const usage: AiUsageRecord = {
      input_tokens: null,
      cached_input_tokens: null,
      output_tokens: null,
      reasoning_tokens: null,
      total_tokens: null,
    };

    const cost = calculateCost("openai_compatible", "gpt-4o-mini", usage);

    expect(cost.total_cost).toBe(0);
    expect(cost.estimated).toBe(true);
  });

  it("calcula con reasoning tokens cuando el pricing los soporta", () => {
    const usage: AiUsageRecord = {
      input_tokens: 1000,
      cached_input_tokens: null,
      output_tokens: 500,
      reasoning_tokens: 200,
      total_tokens: 1700,
    };

    // gpt-4o-mini no tiene reasoning pricing → reasoning_cost = 0
    const cost = calculateCost("openai_compatible", "gpt-4o-mini", usage);
    expect(cost.reasoning_cost).toBe(0);
  });
});
// tests/ai/safety.test.ts — Tests de límites de seguridad
import { describe, it, expect } from "vitest";
import {
  validateAiCallLimits,
  AiCallCounter,
  AI_SAFETY_LIMITS,
} from "@/lib/ai/safety";

describe("validateAiCallLimits", () => {
  it("pasa con parámetros normales", () => {
    const violations = validateAiCallLimits({
      input_chars: 5000,
      max_tokens: 2000,
      timeout_ms: 60000,
    });
    expect(violations).toHaveLength(0);
  });

  it("detecta input excesivo", () => {
    const violations = validateAiCallLimits({
      input_chars: AI_SAFETY_LIMITS.MAX_INPUT_CHARS + 1,
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain("Input");
  });

  it("detecta max_tokens excesivo", () => {
    const violations = validateAiCallLimits({
      max_tokens: AI_SAFETY_LIMITS.MAX_OUTPUT_TOKENS + 1,
    });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("detecta timeout excesivo", () => {
    const violations = validateAiCallLimits({
      timeout_ms: AI_SAFETY_LIMITS.MAX_TIMEOUT_MS + 1,
    });
    expect(violations.length).toBeGreaterThan(0);
  });

  it("no viola con parámetros undefined", () => {
    const violations = validateAiCallLimits({});
    expect(violations).toHaveLength(0);
  });
});

describe("AiCallCounter", () => {
  it("permite llamadas dentro del límite", () => {
    const counter = new AiCallCounter("test-req-1", 5);
    expect(counter.getCount()).toBe(0);
    expect(counter.getRemaining()).toBe(5);

    for (let i = 0; i < 5; i++) {
      counter.tryCall();
    }

    expect(counter.getCount()).toBe(5);
    expect(counter.getRemaining()).toBe(0);
  });

  it("lanza error al exceder el límite", () => {
    const counter = new AiCallCounter("test-req-2", 3);

    counter.tryCall();
    counter.tryCall();
    counter.tryCall();

    expect(() => counter.tryCall()).toThrow(/Límite/);
  });

  it("usa límite por defecto de MAX_AI_CALLS_PER_REQUEST", () => {
    const counter = new AiCallCounter("test-req-3");
    expect(counter.getRemaining()).toBe(AI_SAFETY_LIMITS.MAX_AI_CALLS_PER_REQUEST);
  });
});
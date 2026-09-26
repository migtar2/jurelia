// tests/ai/client.test.ts — Tests del cliente AI centralizado
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAiCentralized } from "@/lib/ai/client";
import type { AiCallOptions } from "@/lib/ai/types";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("callAiCentralized", () => {
  const baseOptions: AiCallOptions = {
    operation_type: "judgment_summary",
    user_id: "test-user-id",
    system_prompt: "Eres un asistente jurídico.",
    user_message: "Analiza esta sentencia.",
    temperature: 0.3,
    max_tokens: 2000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars for tests
    process.env.AI_BASE_URL = "https://test-api.openai.com/v1";
    process.env.AI_API_KEY = "sk-test-key";
    process.env.AI_MODEL = "gpt-4o-mini";
  });

  it("hace llamada HTTP correcta y parsea respuesta", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Respuesta de prueba" } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_tokens_details: { cached_tokens: 0 },
          completion_tokens_details: { reasoning_tokens: 0 },
        },
      }),
    });

    const result = await callAiCentralized(baseOptions);

    expect(result.data).toBe("Respuesta de prueba");
    expect(result.provider).toBe("openai_compatible");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.success).toBe(true);
    expect(result.usage.input_tokens).toBe(100);
    expect(result.usage.output_tokens).toBe(50);
    expect(result.usage.total_tokens).toBe(150);
    expect(result.cost.total_cost).toBeGreaterThan(0);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);

    // Verificar que fetch fue llamado correctamente
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("chat/completions");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toContain("Bearer sk-test-key");
  });

  it("parsea cached tokens correctamente", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Test" } }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 200,
          total_tokens: 1200,
          prompt_tokens_details: { cached_tokens: 500 },
        },
      }),
    });

    const result = await callAiCentralized(baseOptions);

    expect(result.usage.input_tokens).toBe(1000);
    expect(result.usage.cached_input_tokens).toBe(500);
    expect(result.cost.cached_input_cost).toBeGreaterThan(0);
  });

  it("maneja respuesta sin usage del proveedor", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Test sin usage" } }],
        // Sin campo usage
      }),
    });

    const result = await callAiCentralized(baseOptions);

    expect(result.data).toBe("Test sin usage");
    expect(result.usage.input_tokens).toBeNull();
    expect(result.usage.output_tokens).toBeNull();
    expect(result.cost.estimated).toBe(true);
  });

  it("lanza error cuando API key no está configurada", async () => {
    process.env.AI_API_KEY = "";

    await expect(callAiCentralized(baseOptions)).rejects.toThrow(/API key no configurada/);
  });

  it("lanza error cuando el proveedor devuelve HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    });

    await expect(callAiCentralized(baseOptions)).rejects.toThrow(/HTTP 429/);
  });

  it("lanza error cuando la respuesta está vacía", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: null } }],
      }),
    });

    await expect(callAiCentralized(baseOptions)).rejects.toThrow(/vacía/);
  });

  it("usa provider correcto para operaciones MiMo", async () => {
    process.env.MIMO_API_KEY = "mimo-test-key";
    process.env.MIMO_BASE_URL = "https://test-mimo.api.com/v1";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "MiMo result" } }],
        usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      }),
    });

    const result = await callAiCentralized({
      ...baseOptions,
      operation_type: "document_analysis",
      provider: "mimo",
    });

    expect(result.provider).toBe("mimo");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("test-mimo.api.com");
  });

  it("lanza error de seguridad si input excede límite", async () => {
    const longMessage = "x".repeat(60000);

    await expect(
      callAiCentralized({
        ...baseOptions,
        user_message: longMessage,
      })
    ).rejects.toThrow(/Límites excedidos/);
  });
});
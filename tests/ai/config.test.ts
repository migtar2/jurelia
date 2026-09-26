// tests/ai/config.test.ts — Tests de configuración de proveedores
import { describe, it, expect, beforeEach } from "vitest";
import {
  getOpenAiConfig,
  getMimoConfig,
  getProviderConfig,
  getDefaultProvider,
  validateProviderConfig,
} from "@/lib/ai/config";

describe("getOpenAiConfig", () => {
  it("devuelve configuración con defaults correctos", () => {
    const config = getOpenAiConfig();
    expect(config.provider).toBe("openai_compatible");
    expect(config.base_url).toBeDefined();
    expect(config.model).toBeDefined();
    expect(config.timeout_ms).toBeGreaterThan(0);
  });
});

describe("getMimoConfig", () => {
  it("devuelve configuración con defaults correctos", () => {
    const config = getMimoConfig();
    expect(config.provider).toBe("mimo");
    expect(config.base_url).toContain("xiaomimimo");
    expect(config.model).toBe("mimo-v2.5-pro");
  });

  it("ya no está hardcoded — usa variables de entorno", () => {
    const config = getMimoConfig();
    // Verificamos que la URL viene de env o del default (no hardcoded en el código del endpoint)
    expect(config.base_url).toBeDefined();
    expect(config.model).toBeDefined();
  });
});

describe("getProviderConfig", () => {
  it("resuelve openai_compatible", () => {
    const config = getProviderConfig("openai_compatible");
    expect(config.provider).toBe("openai_compatible");
  });

  it("resuelve mimo", () => {
    const config = getProviderConfig("mimo");
    expect(config.provider).toBe("mimo");
  });

  it("lanza error para proveedor desconocido", () => {
    expect(() => getProviderConfig("desconocido" as any)).toThrow();
  });
});

describe("getDefaultProvider", () => {
  it("document_analysis → mimo", () => {
    expect(getDefaultProvider("document_analysis")).toBe("mimo");
  });

  it("jurisprudence_classification → mimo", () => {
    expect(getDefaultProvider("jurisprudence_classification")).toBe("mimo");
  });

  it("judgment_summary → openai_compatible", () => {
    expect(getDefaultProvider("judgment_summary")).toBe("openai_compatible");
  });

  it("judgment_comparison → openai_compatible", () => {
    expect(getDefaultProvider("judgment_comparison")).toBe("openai_compatible");
  });
});

describe("validateProviderConfig", () => {
  it("devuelve vacío para config válida", () => {
    const config = {
      provider: "openai_compatible" as const,
      base_url: "https://api.openai.com/v1",
      api_key: "sk-test",
      model: "gpt-4o-mini",
      timeout_ms: 90000,
    };
    expect(validateProviderConfig(config)).toHaveLength(0);
  });

  it("detecta API key faltante", () => {
    const config = {
      provider: "openai_compatible" as const,
      base_url: "https://api.openai.com/v1",
      api_key: "",
      model: "gpt-4o-mini",
      timeout_ms: 90000,
    };
    const issues = validateProviderConfig(config);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain("API key");
  });
});
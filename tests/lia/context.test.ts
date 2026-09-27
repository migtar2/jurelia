// tests/lia/context.test.ts — Tests de validación y contexto
import { describe, it, expect } from "vitest";
import { validateLiaRequest, formatPageContext } from "@/lib/lia/context";

describe("validateLiaRequest", () => {
  it("acepta request válido mínimo", () => {
    const result = validateLiaRequest({
      message: "¿Qué es JURELIA?",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.message).toBe("¿Qué es JURELIA?");
      expect(result.context.route).toBe("/");
      expect(result.context.module).toBe("search");
    }
  });

  it("acepta request con contexto completo", () => {
    const result = validateLiaRequest({
      message: "test",
      context: {
        route: "/compare",
        module: "compare",
        selection: { roj: "STS 1234/2024" },
      },
      conversation: [
        { role: "user", text: "hola" },
        { role: "lia", text: "¡Hola!" },
      ],
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.context.route).toBe("/compare");
      expect(result.context.module).toBe("compare");
      expect(result.context.selection?.roj).toBe("STS 1234/2024");
      expect(result.conversation).toHaveLength(2);
    }
  });

  it("rechaza body nulo", () => {
    const result = validateLiaRequest(null);
    expect(result.valid).toBe(false);
  });

  it("rechaza mensaje vacío", () => {
    const result = validateLiaRequest({ message: "" });
    expect(result.valid).toBe(false);
  });

  it("rechaza mensaje demasiado largo", () => {
    const result = validateLiaRequest({
      message: "x".repeat(501),
    });
    expect(result.valid).toBe(false);
  });

  it("rechaza contenido con script injection", () => {
    const result = validateLiaRequest({
      message: '<script>alert("xss")</script>',
    });
    expect(result.valid).toBe(false);
  });

  it("normaliza rutas inválidas a /", () => {
    const result = validateLiaRequest({
      message: "test",
      context: { route: "/ruta-que-no-existe" },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.context.route).toBe("/");
    }
  });

  it("trunca conversación larga a 20 mensajes", () => {
    const conversation = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "lia") as "user" | "lia",
      text: `msg ${i}`,
    }));
    const result = validateLiaRequest({
      message: "test",
      conversation,
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.conversation.length).toBeLessThanOrEqual(20);
    }
  });

  it("sanitiza selección con strings demasiado largos", () => {
    const result = validateLiaRequest({
      message: "test",
      context: {
        route: "/",
        selection: {
          roj: "x".repeat(100), // > 50 chars
        },
      },
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      // El ROJ demasiado largo se descarta
      expect(result.context.selection?.roj).toBeUndefined();
    }
  });
});

describe("formatPageContext", () => {
  it("formatea contexto con ruta y selección", () => {
    const text = formatPageContext({
      route: "/compare",
      module: "compare",
      selection: {
        roj: "STS 1234/2024",
        ecli: "ECLI:ES:TS:2024:1234",
        court: "Tribunal Supremo",
        date: "2024-03-15",
      },
    });
    expect(text).toContain("comparación");
    expect(text).toContain("STS 1234/2024");
    expect(text).toContain("ECLI:ES:TS:2024:1234");
    expect(text).toContain("Tribunal Supremo");
    expect(text).toContain("2024-03-15");
  });

  it("formatea contexto sin selección", () => {
    const text = formatPageContext({
      route: "/",
      module: "search",
    });
    expect(text).toContain("buscador");
    expect(text).not.toContain("Resolución seleccionada");
  });
});
// tests/lia/knowledge.test.ts — Tests de la knowledge base
import { describe, it, expect } from "vitest";
import {
  findFaqAnswer,
  searchKnowledgeBase,
  getContextualHelp,
  lookUpGlossary,
  PAGE_DESCRIPTIONS,
  ROUTE_MODULE_MAP,
} from "@/lib/lia/knowledge";

describe("Knowledge Base", () => {
  /* ─── FAQ ─── */
  describe("findFaqAnswer", () => {
    it("encuentra respuesta sobre ROJ vs ECLI", () => {
      const answer = findFaqAnswer("¿Qué diferencia hay entre ROJ y ECLI?");
      expect(answer).toBeTruthy();
      expect(answer).toContain("ROJ");
      expect(answer).toContain("ECLI");
    });

    it("encuentra respuesta sobre límites de workspace", () => {
      const answer = findFaqAnswer("¿Cuántas resoluciones puedo guardar?");
      expect(answer).toBeTruthy();
      expect(answer).toContain("500");
    });

    it("encuentra respuesta sobre exportar", () => {
      const answer = findFaqAnswer("¿Puedo exportar resultados?");
      expect(answer).toBeTruthy();
    });

    it("devuelve null para preguntas sin match", () => {
      const answer = findFaqAnswer("xyzzy plugh");
      expect(answer).toBeNull();
    });
  });

  /* ─── Knowledge base search ─── */
  describe("searchKnowledgeBase", () => {
    it("encuentra información sobre comparación", () => {
      const result = searchKnowledgeBase("comparar resoluciones");
      expect(result).toBeTruthy();
      expect(result).toContain("comparación");
    });

    it("encuentra información sobre workspace", () => {
      const result = searchKnowledgeBase("workspace biblioteca");
      expect(result).toBeTruthy();
    });
  });

  /* ─── Contextual help ─── */
  describe("getContextualHelp", () => {
    it("devuelve ayuda para /", () => {
      const help = getContextualHelp("/");
      expect(help).toBeTruthy();
      expect(help).toContain("buscador");
    });

    it("devuelve ayuda para /compare", () => {
      const help = getContextualHelp("/compare");
      expect(help).toBeTruthy();
      expect(help).toContain("comparación");
    });

    it("devuelve ayuda para /documents", () => {
      const help = getContextualHelp("/documents");
      expect(help).toBeTruthy();
      expect(help).toContain("PDF");
    });

    it("devuelve ayuda para /alerts", () => {
      const help = getContextualHelp("/alerts");
      expect(help).toBeTruthy();
      expect(help).toContain("alertas");
    });

    it("devuelve null para ruta desconocida", () => {
      const help = getContextualHelp("/ruta-inexistente");
      expect(help).toBeNull();
    });
  });

  /* ─── Glossary ─── */
  describe("lookUpGlossary", () => {
    it("encuentra ROJ", () => {
      const def = lookUpGlossary("ROJ");
      expect(def).toBeTruthy();
      expect(def).toContain("identificador nacional");
    });

    it("encuentra ECLI", () => {
      const def = lookUpGlossary("ECLI");
      expect(def).toBeTruthy();
      expect(def).toContain("europeo");
    });

    it("encuentra AI_GENERATED", () => {
      const def = lookUpGlossary("AI_GENERATED");
      expect(def).toBeTruthy();
      expect(def).toContain("modelo de lenguaje");
    });

    it("devuelve null para término inexistente", () => {
      const def = lookUpGlossary("XYZZY");
      expect(def).toBeNull();
    });
  });

  /* ─── Route mappings ─── */
  describe("ROUTE_MODULE_MAP", () => {
    it("mapea todas las rutas conocidas", () => {
      expect(ROUTE_MODULE_MAP["/"]).toBe("search");
      expect(ROUTE_MODULE_MAP["/compare"]).toBe("compare");
      expect(ROUTE_MODULE_MAP["/proposition"]).toBe("proposition");
      expect(ROUTE_MODULE_MAP["/workspace"]).toBe("workspace");
      expect(ROUTE_MODULE_MAP["/alerts"]).toBe("alerts");
      expect(ROUTE_MODULE_MAP["/documents"]).toBe("documents");
    });
  });

  /* ─── Page descriptions ─── */
  describe("PAGE_DESCRIPTIONS", () => {
    it("tiene descripción para todas las rutas del mapa", () => {
      for (const route of Object.keys(ROUTE_MODULE_MAP)) {
        expect(PAGE_DESCRIPTIONS[route]).toBeTruthy();
      }
    });
  });
});
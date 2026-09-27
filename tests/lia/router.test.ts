// tests/lia/router.test.ts — Tests del router de intención
import { describe, it, expect } from "vitest";
import { routeIntent } from "@/lib/lia/router";

describe("routeIntent", () => {
  /* ─── HELP ─── */
  describe("HELP", () => {
    it("¿Qué es JURELIA? → HELP", () => {
      const r = routeIntent("¿Qué es JURELIA?");
      expect(r.intent).toBe("HELP");
    });

    it("¿Qué es el ROJ? → HELP", () => {
      const r = routeIntent("¿Qué es el ROJ?");
      expect(r.intent).toBe("HELP");
    });

    it("¿Cómo comparo dos sentencias? → HELP", () => {
      const r = routeIntent("¿Cómo comparo dos sentencias?");
      expect(r.intent).toBe("HELP");
    });

    it("¿Qué significa AI_GENERATED? → HELP", () => {
      const r = routeIntent("¿Qué significa AI_GENERATED?");
      expect(r.intent).toBe("HELP");
    });
  });

  /* ─── CONTEXT_HELP ─── */
  describe("CONTEXT_HELP", () => {
    it("¿Qué puedo hacer aquí? → CONTEXT_HELP", () => {
      const r = routeIntent("¿Qué puedo hacer aquí?");
      expect(r.intent).toBe("CONTEXT_HELP");
    });

    it("¿Cómo funciona esto? → CONTEXT_HELP", () => {
      const r = routeIntent("¿Cómo funciona esto?");
      expect(r.intent).toBe("CONTEXT_HELP");
    });

    it("ayuda → CONTEXT_HELP", () => {
      const r = routeIntent("ayuda");
      expect(r.intent).toBe("CONTEXT_HELP");
    });
  });

  /* ─── SEARCH_JURISPRUDENCE ─── */
  describe("SEARCH_JURISPRUDENCE", () => {
    it("Busca sentencias sobre despido disciplinario", () => {
      const r = routeIntent("Busca sentencias sobre despido disciplinario");
      expect(r.intent).toBe("SEARCH_JURISPRUDENCE");
      expect(r.extracted?.query).toContain("despido disciplinario");
    });

    it("Encuentra jurisprudencia sobre pensión compensatoria", () => {
      const r = routeIntent("Encuentra jurisprudencia sobre pensión compensatoria");
      expect(r.intent).toBe("SEARCH_JURISPRUDENCE");
    });
  });

  /* ─── GET_DECISION ─── */
  describe("GET_DECISION", () => {
    it("ROJ: STS 1234/2024 → GET_DECISION", () => {
      const r = routeIntent("ROJ: STS 1234/2024");
      expect(r.intent).toBe("GET_DECISION");
      expect(r.extracted?.roj).toBeTruthy();
    });

    it("ECLI:ES:TS:2024:1234 → GET_DECISION", () => {
      const r = routeIntent("ECLI:ES:TS:2024:1234");
      expect(r.intent).toBe("GET_DECISION");
      expect(r.extracted?.ecli).toBeTruthy();
    });

    it("STSJ M 10762/2026 → GET_DECISION (con código tribunal)", () => {
      const r = routeIntent("explícame la resolución STSJ M 10762/2026");
      expect(r.intent).toBe("GET_DECISION");
      expect(r.extracted?.roj).toContain("STSJ");
      expect(r.extracted?.roj).toContain("10762/2026");
    });

    it("STSJ CL 3400/2026 → GET_DECISION (Castilla y León)", () => {
      const r = routeIntent("STSJ CL 3400/2026");
      expect(r.intent).toBe("GET_DECISION");
      expect(r.extracted?.roj).toContain("3400/2026");
    });

    it("AAP A 289/2026 → GET_DECISION (Audiencia Provincial)", () => {
      const r = routeIntent("AAP A 289/2026");
      expect(r.intent).toBe("GET_DECISION");
    });
  });

  /* ─── SYSTEM_STATUS ─── */
  describe("SYSTEM_STATUS", () => {
    it("¿Está funcionando CENDOJ? → SYSTEM_STATUS", () => {
      const r = routeIntent("¿Está funcionando CENDOJ?");
      expect(r.intent).toBe("SYSTEM_STATUS");
    });

    it("¿Funciona el sistema? → SYSTEM_STATUS", () => {
      const r = routeIntent("¿Funciona el sistema?");
      expect(r.intent).toBe("SYSTEM_STATUS");
    });
  });

  /* ─── LEGAL_BOUNDARY ─── */
  describe("LEGAL_BOUNDARY", () => {
    it("¿Voy a ganar este caso? → LEGAL_BOUNDARY", () => {
      const r = routeIntent("¿Voy a ganar este caso?");
      expect(r.intent).toBe("LEGAL_BOUNDARY");
    });

    it("Garantízame el resultado → LEGAL_BOUNDARY", () => {
      const r = routeIntent("Garantízame el resultado del juicio");
      expect(r.intent).toBe("LEGAL_BOUNDARY");
    });

    it("Dame asesoramiento jurídico → LEGAL_BOUNDARY", () => {
      const r = routeIntent("Dame asesoramiento jurídico");
      expect(r.intent).toBe("LEGAL_BOUNDARY");
    });
  });

  /* ─── GREETING ─── */
  describe("GREETING", () => {
    it("hola → GREETING", () => {
      const r = routeIntent("hola");
      expect(r.intent).toBe("GREETING");
    });

    it("buenos días → GREETING", () => {
      const r = routeIntent("buenos días");
      expect(r.intent).toBe("GREETING");
    });
  });
});
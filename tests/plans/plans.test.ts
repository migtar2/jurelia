// tests/plans/plans.test.ts — Tests del sistema de planes y entitlements
import { describe, it, expect } from "vitest";
import {
  getPlanDefinition,
  getAllPlans,
  getCategoryLimit,
  hasFeature,
  isPaidPlan,
  isValidPlanId,
  getDefaultPlan,
} from "@/lib/plans/config";

describe("Plan Configuration", () => {
  describe("getPlanDefinition", () => {
    it("FREE tiene precio 0", () => {
      const plan = getPlanDefinition("free");
      expect(plan.monthly_price_eur).toBe(0);
      expect(plan.display_name).toBe("FREE");
    });

    it("PRO tiene precio 39.90", () => {
      const plan = getPlanDefinition("pro");
      expect(plan.monthly_price_eur).toBe(39.90);
      expect(plan.display_name).toBe("PRO");
    });

    it("UNLIMITED tiene precio 59.90", () => {
      const plan = getPlanDefinition("unlimited");
      expect(plan.monthly_price_eur).toBe(59.90);
      expect(plan.display_name).toBe("UNLIMITED");
    });
  });

  describe("getAllPlans", () => {
    it("devuelve exactamente 3 planes", () => {
      const plans = getAllPlans();
      expect(plans).toHaveLength(3);
      expect(plans.map(p => p.id)).toEqual(["free", "pro", "unlimited"]);
    });
  });

  describe("getCategoryLimit", () => {
    it("FREE: 5 por categoría", () => {
      expect(getCategoryLimit("free", "judgment_summary")).toBe(5);
      expect(getCategoryLimit("free", "document_analysis")).toBe(5);
      expect(getCategoryLimit("free", "report")).toBe(5);
    });

    it("PRO: 200 por categoría", () => {
      expect(getCategoryLimit("pro", "judgment_summary")).toBe(200);
      expect(getCategoryLimit("pro", "document_analysis")).toBe(200);
      expect(getCategoryLimit("pro", "report")).toBe(200);
    });

    it("UNLIMITED: -1 (unlimited) por categoría", () => {
      expect(getCategoryLimit("unlimited", "judgment_summary")).toBe(-1);
      expect(getCategoryLimit("unlimited", "document_analysis")).toBe(-1);
      expect(getCategoryLimit("unlimited", "report")).toBe(-1);
    });
  });

  describe("hasFeature", () => {
    it("FREE: sin full_history, sin export", () => {
      expect(hasFeature("free", "full_history")).toBe(false);
      expect(hasFeature("free", "export")).toBe(false);
      expect(hasFeature("free", "dashboard")).toBe(false);
    });

    it("PRO: full_history + export + dashboard", () => {
      expect(hasFeature("pro", "full_history")).toBe(true);
      expect(hasFeature("pro", "export")).toBe(true);
      expect(hasFeature("pro", "dashboard")).toBe(true);
      expect(hasFeature("pro", "advanced_export")).toBe(false);
    });

    it("UNLIMITED: todo habilitado", () => {
      expect(hasFeature("unlimited", "full_history")).toBe(true);
      expect(hasFeature("unlimited", "export")).toBe(true);
      expect(hasFeature("unlimited", "advanced_export")).toBe(true);
      expect(hasFeature("unlimited", "priority_support")).toBe(true);
      expect(hasFeature("unlimited", "dashboard")).toBe(true);
    });
  });

  describe("isPaidPlan", () => {
    it("FREE no es paid", () => expect(isPaidPlan("free")).toBe(false));
    it("PRO es paid", () => expect(isPaidPlan("pro")).toBe(true));
    it("UNLIMITED es paid", () => expect(isPaidPlan("unlimited")).toBe(true));
  });

  describe("isValidPlanId", () => {
    it("acepta free, pro, unlimited", () => {
      expect(isValidPlanId("free")).toBe(true);
      expect(isValidPlanId("pro")).toBe(true);
      expect(isValidPlanId("unlimited")).toBe(true);
    });

    it("rechaza otros valores", () => {
      expect(isValidPlanId("team")).toBe(false);
      expect(isValidPlanId("enterprise")).toBe(false);
      expect(isValidPlanId("")).toBe(false);
      expect(isValidPlanId("UNLIMITED")).toBe(false); // case sensitive
    });
  });

  describe("getDefaultPlan", () => {
    it("devuelve free", () => {
      expect(getDefaultPlan()).toBe("free");
    });
  });
});

describe("Commercial Limits (Phase 02 pricing decision)", () => {
  it("FREE: 5 por cada categoría", () => {
    const categories = ["jurisprudence_search", "judgment_summary", "judgment_analysis", "comparison", "document_analysis", "report"] as const;
    for (const cat of categories) {
      expect(getCategoryLimit("free", cat)).toBe(5);
    }
  });

  it("PRO: 200 por cada categoría", () => {
    const categories = ["jurisprudence_search", "judgment_summary", "judgment_analysis", "comparison", "document_analysis", "report"] as const;
    for (const cat of categories) {
      expect(getCategoryLimit("pro", cat)).toBe(200);
    }
  });

  it("UNLIMITED: -1 (unlimited) por cada categoría", () => {
    const categories = ["jurisprudence_search", "judgment_summary", "judgment_analysis", "comparison", "document_analysis", "report"] as const;
    for (const cat of categories) {
      expect(getCategoryLimit("unlimited", cat)).toBe(-1);
    }
  });

  it("UNLIMITED NO usa Infinity", () => {
    // Verificar que -1 se usa como representación segura
    const limit = getCategoryLimit("unlimited", "judgment_summary");
    expect(limit).toBe(-1);
    expect(Number.isFinite(limit)).toBe(true); // -1 es finito
  });
});

describe("Security: Price ≠ Authorization", () => {
  it("los permisos dependen de plan_id, no del precio", () => {
    // Verificar que la función hasFeature usa plan ID, no precio
    expect(hasFeature("free", "export")).toBe(false);
    expect(hasFeature("pro", "export")).toBe(true);
    // El precio de FREE es 0 y el de PRO es 39.90,
    // pero la autorización se basa en el string "free"/"pro"
  });
});
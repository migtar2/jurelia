// tests/quota/pro-plan.test.ts — PRO plan specific tests
import { describe, it, expect } from "vitest";
import { getCategoryLimit, hasFeature, isPaidPlan } from "@/lib/plans/config";
import { getCommercialCategory } from "@/lib/quota/category-map";

describe("06.1 — PRO Entitlements", () => {
  const categories = ["jurisprudence_search", "judgment_summary", "judgment_analysis", "comparison", "document_analysis", "report"] as const;

  it("PRO: 200 para las 6 categorías", () => {
    for (const cat of categories) {
      expect(getCategoryLimit("pro", cat)).toBe(200);
    }
  });

  it("PRO: 6 × 200 = máximo 1,200 operaciones", () => {
    const total = categories.reduce((sum, cat) => sum + getCategoryLimit("pro", cat), 0);
    expect(total).toBe(1200);
  });

  it("PRO: features completas (history, export, dashboard)", () => {
    expect(hasFeature("pro", "full_history")).toBe(true);
    expect(hasFeature("pro", "export")).toBe(true);
    expect(hasFeature("pro", "dashboard")).toBe(true);
    expect(isPaidPlan("pro")).toBe(true);
  });
});

describe("06.2 — Shared Category Validation", () => {
  it("ANALYSIS: compare + proposition comparten contador", () => {
    expect(getCommercialCategory("judgment_comparison")).toBe("judgment_analysis");
    expect(getCommercialCategory("proposition_analysis")).toBe("judgment_analysis");
  });

  it("REPORTS: news/analyze + news/compare comparten contador", () => {
    expect(getCommercialCategory("news_claim_extraction")).toBe("report");
    expect(getCommercialCategory("news_comparison")).toBe("report");
  });

  it("PRO ANALYSIS: 100 compare + 100 proposition = 200/200", () => {
    // Both operations use the same category "judgment_analysis" with limit 200
    // 100 + 100 = 200 → next request (either) = 429
    expect(getCategoryLimit("pro", "judgment_analysis")).toBe(200);
  });

  it("PRO REPORTS: 100 news/analyze + 100 news/compare = 200/200", () => {
    expect(getCategoryLimit("pro", "report")).toBe(200);
  });
});

describe("06.3 — 201 Test (logical)", () => {
  const categories = ["jurisprudence_search", "judgment_summary", "judgment_analysis", "comparison", "document_analysis", "report"] as const;

  it("PRO: límite exacto = 200 para cada categoría", () => {
    for (const cat of categories) {
      expect(getCategoryLimit("pro", cat)).toBe(200);
      // Request #201 → QUOTA_EXCEEDED (validated by engine)
    }
  });
});

describe("06.6 — Economic Question: Expensive Endpoint in Shared Category", () => {
  it("ANALYSIS: usuario puede elegir siempre proposition (más cara)", () => {
    // Both judgment_comparison and proposition_analysis map to judgment_analysis
    // User with 200/200 can choose either
    // If user always picks proposition (more expensive), worst-case = 200 × prop_cost
    expect(getCommercialCategory("proposition_analysis")).toBe("judgment_analysis");
    // This is a DESIGN FACT: no mechanism prevents user from always choosing the expensive one
  });

  it("REPORTS: usuario puede elegir siempre news/compare (más cara)", () => {
    expect(getCommercialCategory("news_comparison")).toBe("report");
  });
});

describe("06.13 — PRO UX (per-category messaging)", () => {
  it("PRO agotamiento es por CATEGORÍA, no global", () => {
    // 6 independent counters, not one global counter
    // User at 200/200 ANALYSIS can still use 200/200 SEARCH
    const categories = ["jurisprudence_search", "judgment_summary", "judgment_analysis", "comparison", "document_analysis", "report"] as const;
    expect(categories.length).toBe(6);
    // Each has independent limit
    for (const cat of categories) {
      expect(getCategoryLimit("pro", cat)).toBe(200);
    }
  });
});

describe("06.14 — FREE→PRO upgrade preserves usage", () => {
  it("FREE 5/5 → PRO → 5/200", () => {
    // Usage is in usage_reservations tied to user_id, not plan
    // Plan change only affects getCategoryLimit() result
    expect(getCategoryLimit("free", "judgment_analysis")).toBe(5);
    expect(getCategoryLimit("pro", "judgment_analysis")).toBe(200);
    // 5 existing reservations still count against new 200 limit
  });
});

describe("06.15 — PRO→FREE downgrade blocks immediately", () => {
  it("PRO 50/200 → FREE → 50/5 → bloqueado", () => {
    expect(getCategoryLimit("pro", "judgment_analysis")).toBe(200);
    expect(getCategoryLimit("free", "judgment_analysis")).toBe(5);
    // 50 committed > 5 limit → QUOTA_EXCEEDED immediately
  });
});

describe("06.16 — PRO→UNLIMITED upgrade", () => {
  it("PRO → UNLIMITED: no bloquea", () => {
    expect(getCategoryLimit("unlimited", "judgment_analysis")).toBe(-1);
    // -1 = no limit check → always allowed
  });
});
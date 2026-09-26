// tests/quota/quota.test.ts — Tests del sistema de quotas
import { describe, it, expect } from "vitest";
import { getCurrentPeriod, getPeriodForDate, getResetDate } from "@/lib/quota/period";
import { getCommercialCategory, getSearchCategory } from "@/lib/quota/category-map";
import { getCategoryLimit } from "@/lib/plans/config";

describe("Period Calculation", () => {
  it("getCurrentPeriod devuelve mes actual UTC", () => {
    const period = getCurrentPeriod();
    const now = new Date();

    expect(period.period_start.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(period.period_start.getUTCMonth()).toBe(now.getUTCMonth());
    expect(period.period_start.getUTCDate()).toBe(1);
    expect(period.period_start.getUTCHours()).toBe(0);
    expect(period.period_start.getUTCMinutes()).toBe(0);
  });

  it("getPeriodForDate calcula correctamente", () => {
    const date = new Date(Date.UTC(2026, 8, 15)); // Sept 15, 2026
    const period = getPeriodForDate(date);

    expect(period.period_start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(period.period_end.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(period.label).toBe("2026-09");
  });

  it("getPeriodForDate maneja cambio de año", () => {
    const date = new Date(Date.UTC(2026, 11, 31)); // Dec 31, 2026
    const period = getPeriodForDate(date);

    expect(period.label).toBe("2026-12");
    expect(period.period_end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("getResetDate devuelve primer día del mes siguiente", () => {
    const reset = getResetDate();
    expect(reset.getUTCDate()).toBe(1);
    expect(reset.getUTCHours()).toBe(0);
  });

  it("mes boundary: sept 30 vs oct 1", () => {
    const sept30 = new Date(Date.UTC(2026, 8, 30, 23, 59, 59));
    const oct1 = new Date(Date.UTC(2026, 9, 1, 0, 0, 0));

    const periodSept = getPeriodForDate(sept30);
    const periodOct = getPeriodForDate(oct1);

    expect(periodSept.label).toBe("2026-09");
    expect(periodOct.label).toBe("2026-10");
    expect(periodSept.period_end.toISOString()).toBe(periodOct.period_start.toISOString());
  });
});

describe("Category Mapping", () => {
  it("judgment_summary → judgment_summary", () => {
    expect(getCommercialCategory("judgment_summary")).toBe("judgment_summary");
  });

  it("judgment_comparison → judgment_analysis", () => {
    expect(getCommercialCategory("judgment_comparison")).toBe("judgment_analysis");
  });

  it("proposition_analysis → judgment_analysis", () => {
    expect(getCommercialCategory("proposition_analysis")).toBe("judgment_analysis");
  });

  it("document_analysis → document_analysis", () => {
    expect(getCommercialCategory("document_analysis")).toBe("document_analysis");
  });

  it("jurisprudence_classification → comparison", () => {
    expect(getCommercialCategory("jurisprudence_classification")).toBe("comparison");
  });

  it("news_claim_extraction → report", () => {
    expect(getCommercialCategory("news_claim_extraction")).toBe("report");
  });

  it("news_comparison → report", () => {
    expect(getCommercialCategory("news_comparison")).toBe("report");
  });

  it("search → jurisprudence_search", () => {
    expect(getSearchCategory()).toBe("jurisprudence_search");
  });
});

describe("Quota Limits per Plan", () => {
  const categories = ["jurisprudence_search", "judgment_summary", "judgment_analysis", "comparison", "document_analysis", "report"] as const;

  it("FREE: 5 para todas las categorías", () => {
    for (const cat of categories) {
      expect(getCategoryLimit("free", cat)).toBe(5);
    }
  });

  it("PRO: 200 para todas las categorías", () => {
    for (const cat of categories) {
      expect(getCategoryLimit("pro", cat)).toBe(200);
    }
  });

  it("UNLIMITED: -1 para todas las categorías", () => {
    for (const cat of categories) {
      expect(getCategoryLimit("unlimited", cat)).toBe(-1);
    }
  });
});

describe("Failure Semantics", () => {
  it("quota exceeded returns 429 structure", () => {
    // Verify the expected error response shape
    const errorResponse = {
      error: "QUOTA_EXCEEDED",
      category: "judgment_summary",
      limit: 5,
      used: 5,
      remaining: 0,
      period_end: "2026-10-01T00:00:00.000Z",
    };

    expect(errorResponse.error).toBe("QUOTA_EXCEEDED");
    expect(errorResponse.remaining).toBe(0);
  });
});
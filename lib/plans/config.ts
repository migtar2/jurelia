// lib/plans/config.ts — Configuración central de planes
// ÚNICA fuente de verdad para límites, precios y entitlements.

import type { PlanDefinition, PlanId, CommercialCategory } from "./types";

/**
 * Definiciones de planes.
 * Los límites son por MES y por categoría comercial.
 * -1 = unlimited (representación segura, NO Infinity).
 */
const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "free",
    display_name: "FREE",
    monthly_price_eur: 0,
    entitlements: {
      limits: {
        jurisprudence_search: 5,
        judgment_summary: 5,
        judgment_analysis: 5,
        comparison: 5,
        document_analysis: 5,
        report: 5,
      },
      features: {
        full_history: false,
        export: false,
        advanced_export: false,
        priority_support: false,
        dashboard: false,
      },
    },
  },

  pro: {
    id: "pro",
    name: "pro",
    display_name: "PRO",
    monthly_price_eur: 39.90,
    entitlements: {
      limits: {
        jurisprudence_search: 200,
        judgment_summary: 200,
        judgment_analysis: 200,
        comparison: 200,
        document_analysis: 200,
        report: 200,
      },
      features: {
        full_history: true,
        export: true,
        advanced_export: false,
        priority_support: false,
        dashboard: true,
      },
    },
  },

  unlimited: {
    id: "unlimited",
    name: "unlimited",
    display_name: "UNLIMITED",
    monthly_price_eur: 59.90,
    entitlements: {
      limits: {
        jurisprudence_search: -1, // unlimited
        judgment_summary: -1,
        judgment_analysis: -1,
        comparison: -1,
        document_analysis: -1,
        report: -1,
      },
      features: {
        full_history: true,
        export: true,
        advanced_export: true,
        priority_support: true,
        dashboard: true,
      },
    },
  },
};

/**
 * Obtener definición de plan por ID.
 */
export function getPlanDefinition(planId: PlanId): PlanDefinition {
  return PLANS[planId];
}

/**
 * Obtener todos los planes disponibles.
 */
export function getAllPlans(): PlanDefinition[] {
  return Object.values(PLANS);
}

/**
 * Obtener el límite mensual de una categoría para un plan.
 * Retorna -1 para unlimited, o el número exacto.
 */
export function getCategoryLimit(planId: PlanId, category: CommercialCategory): number {
  return PLANS[planId].entitlements.limits[category];
}

/**
 * Verificar si un plan tiene una feature booleana.
 */
export function hasFeature(planId: PlanId, feature: keyof PlanDefinition["entitlements"]["features"]): boolean {
  return PLANS[planId].entitlements.features[feature];
}

/**
 * Verificar si un plan es de pago.
 */
export function isPaidPlan(planId: PlanId): boolean {
  return planId === "pro" || planId === "unlimited";
}

/**
 * Verificar si un plan ID es válido.
 */
export function isValidPlanId(planId: string): planId is PlanId {
  return (["free", "pro", "unlimited"] as readonly string[]).includes(planId);
}

/**
 * Obtener el plan por defecto para nuevos usuarios.
 */
export function getDefaultPlan(): PlanId {
  return "free";
}
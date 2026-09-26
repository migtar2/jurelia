// lib/plans/types.ts — Tipos del sistema de planes

export const PLAN_IDS = ["free", "pro", "unlimited"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_STATUS = ["active", "cancelled", "expired", "suspended"] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

/**
 * Categorías comerciales que el usuario ve.
 * NO = 1:1 con operation_types técnicos.
 */
export const COMMERCIAL_CATEGORIES = [
  "jurisprudence_search",   // Búsquedas jurisprudenciales
  "judgment_summary",       // Resúmenes de sentencias
  "judgment_analysis",      // Análisis de sentencias
  "comparison",             // Comparaciones
  "document_analysis",      // Análisis documental
  "report",                 // Informes / Noticias
] as const;

export type CommercialCategory = (typeof COMMERCIAL_CATEGORIES)[number];

/**
 * Entitlements de un plan.
 */
export interface PlanEntitlements {
  /** Límites mensuales por categoría comercial. -1 = unlimited. */
  limits: Record<CommercialCategory, number>;

  /** Funcionalidades booleanas. */
  features: {
    full_history: boolean;       // Historial completo
    export: boolean;             // Exportación básica
    advanced_export: boolean;    // Exportación avanzada
    priority_support: boolean;   // Soporte prioritario
    dashboard: boolean;          // Dashboard de consumo
  };
}

/**
 * Definición completa de un plan.
 */
export interface PlanDefinition {
  id: PlanId;
  name: string;
  display_name: string;
  monthly_price_eur: number;
  entitlements: PlanEntitlements;
  /** Para compatibilidad futura con Stripe. */
  stripe_price_id?: string;
}

/**
 * Suscripción de un usuario.
 */
export interface UserSubscription {
  id: string;
  user_id: string;
  plan: PlanId;
  status: PlanStatus;
  effective_from: Date;
  effective_until: Date | null;
  source: "admin" | "stripe" | "default" | "migration";
  created_at: Date;
  updated_at: Date;
}

/**
 * Resultado de verificar si un usuario puede usar una feature.
 */
export interface EntitlementCheck {
  allowed: boolean;
  plan: PlanId;
  category?: CommercialCategory;
  limit?: number;
  used?: number;
  remaining?: number;
  reason?: string;
}
// lib/plans/index.ts — Barrel export

export { getPlanDefinition, getAllPlans, getCategoryLimit, hasFeature, isPaidPlan, isValidPlanId, getDefaultPlan } from "./config";
export { getUserPlan, getUserPlanDefinition, getEntitlements, canUseFeature, assignPlan } from "./entitlements";
export type { PlanId, PlanStatus, CommercialCategory, PlanEntitlements, PlanDefinition, UserSubscription, EntitlementCheck } from "./types";
export { PLAN_IDS, PLAN_STATUS, COMMERCIAL_CATEGORIES } from "./types";
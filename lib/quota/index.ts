// lib/quota/index.ts — Barrel export

export { getCurrentPeriod, getPeriodForDate, isInPeriod, getResetDate } from "./period";
export { getQuotaStatus, reserveQuota, commitReservation, releaseReservation, withQuota, isQuotaEnforcementEnabled } from "./engine";
export { reconcileZombieReservations, countZombieReservations } from "./reconcile";
export { getCommercialCategory, getSearchCategory, isValidCommercialCategory } from "./category-map";
export type { UsagePeriod, ReservationState, QuotaReservation, QuotaStatus, QuotaCheckResult } from "./types";
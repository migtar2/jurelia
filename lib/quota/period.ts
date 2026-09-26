// lib/quota/period.ts — Cálculo de periodos de cuota (mes natural UTC)

import type { UsagePeriod } from "./types";

/**
 * Obtener el periodo de cuota actual (mes natural UTC).
 * Ejemplo: 2026-09-15 → { start: 2026-09-01, end: 2026-10-01, label: "2026-09" }
 */
export function getCurrentPeriod(): UsagePeriod {
  const now = new Date();
  return getPeriodForDate(now);
}

/**
 * Obtener el periodo para una fecha dada.
 */
export function getPeriodForDate(date: Date): UsagePeriod {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed

  const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  const label = `${year}-${String(month + 1).padStart(2, "0")}`;

  return { period_start: periodStart, period_end: periodEnd, label };
}

/**
 * Verificar si una fecha cae en un periodo dado.
 */
export function isInPeriod(date: Date, period: UsagePeriod): boolean {
  return date >= period.period_start && date < period.period_end;
}

/**
 * Obtener la fecha de reset (primer día del siguiente mes UTC).
 */
export function getResetDate(): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
}
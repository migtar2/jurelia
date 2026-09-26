// lib/quota/types.ts — Tipos del sistema de quotas

import type { CommercialCategory } from "@/lib/plans/types";

export interface UsagePeriod {
  period_start: Date; // First instant of month UTC
  period_end: Date;   // First instant of next month UTC
  label: string;      // "2026-09"
}

export type ReservationState = "reserved" | "committed" | "released";

export interface QuotaReservation {
  id: string;
  user_id: string;
  category: CommercialCategory;
  period_start: Date;
  state: ReservationState;
  created_at: Date;
}

export interface QuotaStatus {
  category: CommercialCategory;
  limit: number;      // -1 = unlimited
  used: number;       // committed count
  reserved: number;   // reserved (in-flight) count
  remaining: number;  // limit - used - reserved (-1 = unlimited)
  unlimited: boolean;
  period_start: string;
  period_end: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reservation_id?: string;
  quota_status: QuotaStatus;
  reason?: string;
}
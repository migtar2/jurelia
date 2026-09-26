# QUOTA ARCHITECTURE

**Fecha:** 2026-09-26
**Fase:** 04

---

## ARQUITECTURA

```
lib/quota/
├── types.ts        — QuotaStatus, QuotaCheckResult, UsagePeriod
├── period.ts       — getCurrentPeriod, getPeriodForDate, isInPeriod
├── engine.ts       — reserveQuota, commitReservation, releaseReservation, withQuota
├── reconcile.ts    — reconcileZombieReservations, countZombieReservations
├── category-map.ts — operation_type → commercial category mapping
└── index.ts        — Barrel export

DB: usage_reservations (6 campos, 2 índices)
API: GET /api/usage
```

---

## FLUJO DE OPERACIÓN

```
1. Authenticate (requireAuth)
2. Resolve plan server-side (getUserPlan → DB)
3. Resolve commercial category (getCommercialCategory)
4. withQuota(userId, category, operation):
   a. Si !QUOTA_ENFORCEMENT_ENABLED → ejecutar directamente
   b. reserveQuota():
      - reconcileZombieReservations() (cleanup inline)
      - pg_advisory_xact_lock() (serializar)
      - count(committed + reserved) < limit?
      - INSERT reservation (state: reserved)
   c. operation() → ejecutar operación real
   d. Éxito → commitReservation() (state: committed)
   e. Error → releaseReservation() (state: released)
5. Devolver resultado + _quota metadata
```

---

## ATOMICIDAD

- PostgreSQL `pg_advisory_xact_lock()` serializa acceso concurrente
- La transacción es: lock → count → check → insert
- Dos requests concurrentes: una espera, la otra primero
- La segunda lee el count actualizado y rechaza si se alcanzó el límite

---

## CRASH RECOVERY

- Reservas en estado `reserved` por > 5 minutos se consideran zombie
- `reconcileZombieReservations()` las pasa a `released`
- Se ejecuta inline antes de cada nueva reserva (no requiere cron)
- También puede ejecutarse vía cron si se desea limpieza periódica

---

## FEATURE FLAG

- `QUOTA_ENFORCEMENT_ENABLED=true` → activa enforcement
- Default: desactivado (sin impacto en producción)
- Permite: deploy code → smoke test → activar enforcement sin redeploy

---

## PERIOD

- Mes natural UTC
- `2026-09-01T00:00:00Z` hasta `2026-10-01T00:00:00Z`
- No depende de timezone del navegador
- Diseñado para alinear con Stripe billing cycle en Phase 08
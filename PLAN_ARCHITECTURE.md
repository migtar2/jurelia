# PHASE 03 — PLAN ARCHITECTURE

**Fecha:** 2026-09-26

---

## ARQUITECTURA

```
lib/plans/
├── types.ts        — PlanId, CommercialCategory, PlanDefinition, EntitlementCheck
├── config.ts       — ÚNICA fuente de verdad (PLAN_LIMITS, PLAN_FEATURES)
├── entitlements.ts — getUserPlan(), canUseFeature(), assignPlan()
└── index.ts        — Barrel export

DB: user_subscriptions
API: /api/admin/plans (GET query, POST assign)
```

---

## REGLAS ARQUITECTÓNICAS

1. **UNA fuente de verdad** — `lib/plans/config.ts` define todo
2. **Server-side only** — `getUserPlan()` nunca se llama desde cliente
3. **Price ≠ Authorization** — permisos dependen de `plan_id`, no del precio
4. **Fail closed** — estado desconocido → FREE
5. **No client trust** — `req.body.plan` nunca se usa para autorización
6. **Stripe-ready** — `user_subscriptions` tiene campos para Stripe Price ID

---

## PLAN DEFINITIONS

| Plan | Price | Limits | Features |
|---|---|---|---|
| FREE | €0 | 5/cat | Solo uso básico |
| PRO | €39.90 | 200/cat | history, export, dashboard |
| UNLIMITED | €59.90 | -1 (unlimited) | Todo |

---

## MIGRATION

Todos los usuarios existentes → FREE (source: "migration").
No se pierden datos.
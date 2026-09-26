# PHASE 01 — PLAN

**Objetivo:** Centralizar observabilidad de costes AI y proteger endpoints AI sin auth.

**Commit baseline:** b9604f0
**Fecha:** 2026-09-26

---

## ALCANCE

1. **Security precondition** — Añadir auth a summarize, compare, proposition
2. **Central AI module** — lib/ai/ centralizado
3. **Provider config** — MiMo configurable via env
4. **Operation taxonomy** — Enum de operaciones AI
5. **Database** — Tabla ai_usage_log
6. **Real usage parsing** — Capturar tokens reales del proveedor
7. **Pricing engine** — Config centralizada de precios
8. **Economic safety** — Límites básicos anti-abuso
9. **Test infrastructure** — Vitest + tests mockeados
10. **Internal dashboard** — /admin/ai-costs protegido
11. **Security review** — Auditoría endpoints AI

## FUERA DE ALCANCE

- Planes FREE/PRO/UNLIMITED (Phase 03)
- Quotas per-user (Phase 04)
- Stripe (Phase 08)
- RBAC completo (Phase 11)
- Rate limiting distribuido (futuro)

## ARCHIVOS AFECTADOS

### Nuevos
- lib/ai/client.ts — cliente AI centralizado
- lib/ai/config.ts — configuración proveedores
- lib/ai/pricing.ts — motor de precios
- lib/ai/types.ts — tipos y taxonomía
- lib/ai/safety.ts — límites económicos
- lib/db/schema.ts — añadir ai_usage_log
- drizzle/ — nueva migración
- app/admin/ai-costs/ — dashboard interno
- app/api/admin/ai-costs/ — API dashboard
- vitest.config.ts
- tests/ai/ — tests

### Modificados
- app/api/cendoj/summarize/route.ts — auth + central AI
- app/api/cendoj/compare/route.ts — auth + central AI
- app/api/cendoj/proposition/route.ts — auth + central AI
- app/api/documents/analyze/route.ts — central AI
- app/api/documents/search-jurisprudence/route.ts — central AI
- app/api/news/compare/route.ts — auth + central AI

## RIESGOS

- Añadir auth a endpoints públicos puede romper UX si hay usuarios anónimos
- Captura de tokens puede no estar disponible en todos los proveedores
- Tests mockeados no cubren comportamiento real del proveedor

## CRITERIOS DE ACEPTACIÓN

Ver ACCEPTANCE CRITERIA en el master program (15 items).

## ROLLBACK

Cada sub-fase es independiente. Si auth rompe algo, revertir solo el cambio de auth.
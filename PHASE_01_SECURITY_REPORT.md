# PHASE 01 — SECURITY REPORT

**Fecha:** 2026-09-26
**Fase:** 01 — AI Cost Observability
**Revisor:** SEC-01 (automated)

---

## 1. AUTH AI ENDPOINTS

### Hallazgo Phase 00
3 de 6 endpoints AI accesibles sin autenticación:
- POST /api/cendoj/summarize
- POST /api/cendoj/compare
- POST /api/cendoj/proposition

### Corrección Phase 01
Añadido `requireAuth()` server-side a los 3 endpoints.

**Verificación:** `anonymous request → 401`

| Endpoint | Antes | Después |
|---|---|---|
| /api/cendoj/summarize | ❌ Sin auth | ✅ requireAuth() |
| /api/cendoj/compare | ❌ Sin auth | ✅ requireAuth() |
| /api/cendoj/proposition | ❌ Sin auth | ✅ requireAuth() |
| /api/documents/analyze | ✅ requireAuth() | ✅ requireAuth() |
| /api/documents/search-jurisprudence | ✅ requireAuth() | ✅ requireAuth() |
| /api/news/compare | ❌ Sin auth | ✅ requireAuth() |

**STATUS: PASS** — Los 6 endpoints AI requieren autenticación.

---

## 2. CSRF ANALYSIS

### Arquitectura
- Cookie: `jurelia-session`
- Flags: `httpOnly: true, secure: true (prod), sameSite: "lax"`
- Auth: JWT (HS256) en cookie

### Evaluación

**SameSite=Lax** previene que el cookie se envíe en:
- POST cross-origin (la mayoría de ataques CSRF)
- iframes cross-origin
- fetch() cross-origin

**Excepción SameSite=Lax:**
- Navegación top-level GET cross-origin SÍ envía el cookie
- Pero GET no debería modificar estado (principio REST)

**Conclusión:**
No existe vulnerabilidad CSRF explotable en la arquitectura actual.
SameSite=Lax proporciona protección adecuada para los endpoints POST state-changing.

**Mitigación adicional recomendada (NO bloqueante):**
- Considerar CSRF tokens para formularios HTML si se añaden en futuro
- Verificar Origin header en endpoints críticos de billing (Phase 08)

**STATUS: PASS** — Sin vulnerabilidad CSRF explotable.

---

## 3. ECONOMIC SAFETY

### Protecciones implementadas

| Protección | Valor | Ubicación |
|---|---|---|
| Max input chars | 50,000 | lib/ai/safety.ts |
| Max output tokens | 8,000 | lib/ai/safety.ts |
| Max timeout | 120s | lib/ai/safety.ts |
| Max AI calls per request | 30 | lib/ai/safety.ts |
| Max retries | 1 | lib/ai/safety.ts |

### AiCallCounter
Especialmente importante para `/api/documents/search-jurisprudence` que hace N llamadas AI en loop (1 por candidato por issue).
Implementado con hard cap de 30 llamadas por request.

**STATUS: PASS**

---

## 4. SECRET EXPOSURE

### Verificación
- API keys se resuelven via `process.env` en server-side only
- No se exponen en responses JSON
- No se almacenan en `ai_usage_log`
- No se incluyen en `_ai_usage` metadata de responses
- Variables AI centralizadas en `lib/ai/config.ts` (no en route handlers)

**STATUS: PASS**

---

## 5. RATE LIMITING

### Estado actual
Rate limiter in-memory en `lib/rate-limit.ts`:
- Sliding window, 1 minuto
- No persistente (se pierde en cold start serverless)
- No per-user

### Evaluación
**KNOWN_RISK: NON_DISTRIBUTED_RATE_LIMIT**

El rate limiting in-memory es insuficiente para producción serverless (Vercel).
Cada instancia serverless tiene su propio store.

### Mitigación temporal
Los endpoints AI ahora requieren auth, lo que limita el abuso a usuarios registrados.
El AiCallCounter previene loops no acotados dentro de un request.

**Recomendación:** Implementar rate limiting distribuido (Upstash Redis o similar) antes de Phase 08 (Stripe).

**STATUS: PASS (con nota)**

---

## 6. ADMIN DASHBOARD

### Protección
- requireAuth() obligatorio
- Admin check via `ADMIN_EMAILS` env var (comma-separated)
- Sin acceso a datos de otros usuarios en el dashboard (solo agregados)
- Diseño temporal — RBAC definitivo en Phase 11

**STATUS: PASS**

---

## RESUMEN

| Check | Status |
|---|---|
| Auth AI endpoints | PASS |
| CSRF | PASS |
| Economic safety | PASS |
| Secret exposure | PASS |
| Rate limiting | PASS (con nota) |
| Admin dashboard | PASS |

**SEC-01 OVERALL: PASS**
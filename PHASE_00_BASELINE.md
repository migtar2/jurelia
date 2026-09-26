# PHASE 00 — BASELINE & FREEZE

**Fecha:** 2026-09-26
**Commit:** 1b8b04a (JURELIA v1.8.0)
**Estado:** PASS

---

## 1. STACK

| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Next.js | 16.3.6 |
| UI | React | 19.2.8 |
| Language | TypeScript | ^5 |
| CSS | Tailwind CSS | 4 |
| ORM | Drizzle ORM | 0.45.3 |
| DB | PostgreSQL (Neon) | serverless |
| Auth | Custom JWT (jose) | 6.2.12 |
| Hashing | bcryptjs | 3.0.3 |
| Validation | Zod | 4.6.5 |
| Email | Resend | 6.29.0 |
| HTML parsing | cheerio + jsdom + linkedom | — |
| DOCX | mammoth | 1.12.3 |
| PDF | pdf-parse | 2.4.5 |
| Migrations | drizzle-kit | 0.31.11 |

---

## 2. DATABASE — 16 tablas

| Tabla | Propósito | FK principal |
|---|---|---|
| users | Usuarios | — |
| saved_decisions | Sentencias guardadas | users |
| folders | Carpetas | users |
| folder_decisions | Junction carpeta↔sentencia | folders, saved_decisions |
| tags | Etiquetas | users |
| decision_tags | Junction sentencia↔etiqueta | saved_decisions, tags |
| notes | Notas sobre sentencias | saved_decisions, users |
| saved_searches | Búsquedas guardadas | users |
| alerts | Alertas automáticas | saved_searches |
| alert_executions | Historial ejecuciones alerta | alerts |
| alert_seen_decisions | Decisiones ya vistas por alerta | alerts |
| email_deliveries | Emails enviados | alerts, alert_executions |
| news_analyses | Análisis de noticias | users, folders |
| documents | Documentos subidos | users |
| document_analyses | Análisis IA de documentos | documents, users |
| document_research_results | Resultados investigación | documents, documentAnalyses, users |
| beta_feedback | Feedback beta | users |
| saved_documents | Docs guardados en workspace | users, documents, documentAnalyses |

**Migraciones:** 4 archivos SQL (0000–0003).

---

## 3. AUTH

- Custom JWT (HS256, jose) en cookie httpOnly `jurelia-session`
- Expiración: 24h
- bcrypt hash cost: 12
- `requireAuth()` → devuelve `{ userId, email }` o 401
- **NO hay roles** (admin/user)
- **NO hay workspaces/organizaciones**
- **NO hay multi-tenant isolation**
- Middleware: solo security headers (CSP, HSTS, X-Frame-Options)
- Middleware NO protege rutas — cada API route llama `requireAuth()` individualmente

---

## 4. ENDPOINTS API — 36 rutas

### Auth (4)
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/register

### CENDOJ proxy (5) — SIN auth
- GET /api/cendoj/search → proxy a VPS CENDOJ
- GET /api/cendoj/decision → proxy PDF text
- GET /api/cendoj/status
- POST /api/cendoj/summarize → **AI** (AI_BASE_URL)
- POST /api/cendoj/compare → **AI** (AI_BASE_URL)

### Proposition (1) — SIN auth
- POST /api/cendoj/proposition → **AI** (AI_BASE_URL) + CENDOJ search

### Documents (3) — CON auth
- POST /api/documents/upload
- POST /api/documents/analyze → **AI** (MiMo)
- POST /api/documents/search-jurisprudence → **AI** (MiMo) + CENDOJ search

### News (2) — SIN auth
- POST /api/news/analyze → CENDOJ search (no AI directo)
- POST /api/news/compare → **AI** (AI_BASE_URL) × 2 llamadas

### Workspace (17) — CON auth
- CRUD /api/workspace/decisions
- CRUD /api/workspace/documents
- CRUD /api/workspace/folders
- CRUD /api/workspace/searches
- CRUD /api/workspace/tags
- CRUD /api/workspace/news
- GET /api/workspace/decisions/[id]/notes
- GET /api/workspace/decisions/[id]/tags

### Alerts (7) — CON auth
- CRUD /api/alerts
- /api/alerts/execute (cron)
- /api/alerts/stats
- /api/alerts/[id]/pause, /resume, /execuciones

### Feedback (1) — CON auth
- POST /api/feedback

### Admin (1)
- GET /admin/feedback (page)

---

## 5. ENDPOINTS AI — Inventario detallado

Ver `AI_ENDPOINT_INVENTORY.md` separado.

**Resumen:**
- 6 endpoints invocan modelos AI
- 2 proveedores: AI_BASE_URL (OpenAI-compatible) + MiMo (xiaomimimo.com)
- 2 modelos: configurable (default gpt-4o-mini) + mimo-v2.5-pro
- **NINGUNO registra tokens, coste, ni usage del proveedor**
- **NINGUNO tiene quota per-user**
- **3 de 6 no requieren autenticación**

---

## 6. VARIABLES DE ENTORNO

| Variable | Usada en | Requerida |
|---|---|---|
| DATABASE_URL | db/index.ts, drizzle.config.ts | Sí |
| AUTH_SECRET | auth/session.ts | Sí (prod) |
| CENDOJ_API_URL | client.ts, 5 endpoints | No (default 127.0.0.1:8000) |
| CENDOJ_SERVICE_TOKEN | client.ts, 5 endpoints | No |
| AI_BASE_URL | 4 endpoints AI | No (default OpenAI) |
| AI_API_KEY | 4 endpoints AI | Sí para AI |
| AI_MODEL | 4 endpoints AI | No (default gpt-4o-mini) |
| MIMO_API_KEY | 2 endpoints (analyze, search-jurisprudence) | Sí para docs |
| RESEND_API_KEY | email.ts | Sí para alertas |

**Problema:** variables AI dispersas en cada route handler, no centralizadas.

---

## 7. SEGURIDAD — Estado actual

### Implementado
- Security headers en middleware (CSP, HSTS, X-Frame-Options, etc.)
- SSRF protection: solo URLs poderjudicial.es
- bcrypt hashing (cost 12)
- JWT httpOnly cookies
- Ownership checks en workspace routes
- Input validation básica (Zod en algunos, manual en otros)
- Rate limit in-memory (lib/rate-limit.ts) — 1 minuto sliding window

### NO implementado
- CSRF protection
- Rate limiting per-user persistente
- Admin role / authorization
- Tenant isolation
- Webhook signature verification
- Audit logging
- Secret rotation
- Input sanitization completa (XSS en campos de texto)
- Protection contra enumeration (mensajes de error revelan existencia de usuarios)

---

## 8. TESTS

**0 tests.** No hay:
- Unit tests
- Integration tests
- E2E tests
- Test framework configurado
- Scripts de test en package.json

Hay archivos de resultados E2E previos (e2e_results.json, e2e_v2_results.json, e2e_v3_results.json) que parecen ser pruebas manuales/documentadas, no tests automatizados.

---

## 9. INFRAESTRUCTURA

- **Frontend/API:** Vercel (cendoj.vercel.app)
- **DB:** Neon PostgreSQL (ep-morning-bar-b178vwip, región eu-central-1)
- **API Backend:** VPS 31.70.136.34 (Docker cendoj-api, Caddy reverse proxy)
- **CENDOJ Backend URL:** cendoj-api.31-70-136-34.sslip.io
- **Cron:** Vercel cron, 1×/día (08:00 UTC) para /api/alerts/execute
- **Email:** Resend
- **AI Provider 1:** OpenAI-compatible (configurable via AI_BASE_URL)
- **AI Provider 2:** Xiaomi MiMo (api.xiaomimimo.com)

---

## 10. PÁGINAS — 9 rutas

| Ruta | Auth | Descripción |
|---|---|---|
| / | No | Landing/search principal |
| /compare | No | Comparar 2 sentencias |
| /proposition | No | Análisis de proposición jurídica |
| /workspace | Sí | Workspace personal |
| /alerts | Sí | Gestión de alertas |
| /news-compare | No | Análisis de noticias |
| /documents | Sí | Gestión de documentos |
| /help | No | Ayuda |
| /auth/login | No | Login |
| /auth/register | No | Registro |
| /admin/feedback | Admin? | Feedback beta |

---

## 11. GATE VERIFICATION

- [x] App funciona como antes (0 TS errors, build OK)
- [x] Stack inventariado
- [x] DB schema documentado (16 tablas)
- [x] Auth documentado
- [x] Endpoints inventariados (36 rutas)
- [x] AI endpoints inventariados (6 rutas con AI)
- [x] Variables de entorno documentadas
- [x] Seguridad revisada
- [x] Tests verificados (0 existentes)
- [x] Infraestructura documentada

**STATUS: PASS**
**DEPLOY: N/A (read-only phase)**
**NEXT PHASE: 01 — AI Cost Observability**
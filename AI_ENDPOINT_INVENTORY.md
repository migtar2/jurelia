# AI ENDPOINT INVENTORY

**Fecha:** 2026-09-26
**Commit:** 1b8b04a

---

## PROVEEDORES AI

### Proveedor 1: OpenAI-Compatible
- **Base URL:** `AI_BASE_URL` (default: `https://api.openai.com/v1`)
- **API Key:** `AI_API_KEY`
- **Modelo:** `AI_MODEL` (default: `gpt-4o-mini`)
- **Endpoints que lo usan:** summarize, compare, proposition, news/compare

### Proveedor 2: Xiaomi MiMo
- **Base URL:** hardcoded `https://api.xiaomimimo.com/v1/chat/completions`
- **API Key:** `MIMO_API_KEY`
- **Modelo:** hardcoded `mimo-v2.5-pro`
- **Endpoints que lo usan:** documents/analyze, documents/search-jurisprudence

---

## ENDPOINTS AI — Detalle

### 1. POST /api/cendoj/summarize
- **Auth:** NO
- **Proveedor:** OpenAI-compatible
- **Operación:** Resumen estructurado de sentencia
- **Tokens input (estimado):** ~3,000-15,000 (texto truncado a 15,000 chars)
- **Tokens output (config):** max_tokens: 2,000
- **Temperatura:** 0.3
- **Formato respuesta:** json_object
- **Llamadas AI por request:** 1
- **Llamadas CENDOJ por request:** 0-1 (si necesita fetch PDF)
- **Rate limit:** NO
- **Quota:** NO
- **Registra usage:** NO
- **Registra coste:** NO

### 2. POST /api/cendoj/compare
- **Auth:** NO
- **Proveedor:** OpenAI-compatible
- **Operación:** Comparación estructurada de 2 sentencias
- **Tokens input (estimado):** ~5,000-24,000 (2 textos × 12,000 chars max)
- **Tokens output (config):** max_tokens: 4,000
- **Temperatura:** 0.3
- **Formato respuesta:** json_object
- **Llamadas AI por request:** 1
- **Llamadas CENDOJ por request:** 0-2 (fetch PDFs)
- **Rate limit:** NO
- **Quota:** NO
- **Registra usage:** NO
- **Registra coste:** NO

### 3. POST /api/cendoj/proposition
- **Auth:** NO
- **Proveedor:** OpenAI-compatible
- **Operación:** Análisis de proposición jurídica vs jurisprudencia
- **Tokens input (estimado):** ~200 (extract terms) + ~10,000-80,000 (análisis, hasta 10 decisiones × 8,000 chars)
- **Tokens output (config):** max_tokens: 500 (extract) + 4,000 (analysis)
- **Temperatura:** 0.2 (extract) + 0.3 (analysis)
- **Formato respuesta:** json_object
- **Llamadas AI por request:** 2 (extract terms + analyze)
- **Llamadas CENDOJ por request:** 2-20 (search + fetch texts)
- **Rate limit:** NO
- **Quota:** NO
- **Registra usage:** NO
- **Registra coste:** NO
- **NOTA:** Endpoint más costoso potencialmente — hasta 10 decisiones analizadas

### 4. POST /api/documents/analyze
- **Auth:** SÍ (requireAuth)
- **Proveedor:** MiMo (mimo-v2.5-pro)
- **Operación:** Extracción de issues, argumentos, citas de documento legal
- **Tokens input (estimado):** ~1,000-12,000 (texto truncado a 12,000 chars)
- **Tokens output (config):** max_tokens: 4,000
- **Temperatura:** 0.1
- **Formato respuesta:** JSON parseado manualmente
- **Llamadas AI por request:** 1
- **Rate limit:** NO
- **Quota:** NO
- **Registra usage:** NO
- **Registra coste:** NO
- **NOTA:** Ownership check presente. Análisis cached (rechaza re-análisis).

### 5. POST /api/documents/search-jurisprudence
- **Auth:** SÍ (requireAuth)
- **Proveedor:** MiMo (mimo-v2.5-pro)
- **Operación:** Clasificación de relación jurisprudencia ↔ issue
- **Tokens input (estimado):** ~200-800 por clasificación × hasta 5 issues × ~5 candidatos = ~5,000-20,000 total
- **Tokens output (config):** max_tokens: 300 por llamada
- **Temperatura:** 0.1
- **Formato respuesta:** JSON parseado manualmente
- **Llamadas AI por request:** 1-N (una por candidato por issue, potencialmente 25+)
- **Llamadas CENDOJ por request:** N (search por issue, 6 queries por issue)
- **Rate limit:** NO
- **Quota:** NO
- **Registra usage:** NO
- **Registra coste:** NO
- **NOTA:** Endpoint con más llamadas AI. Hasta 5 issues × 5 candidatos = 25 llamadas AI secuenciales.

### 6. POST /api/news/compare
- **Auth:** NO
- **Proveedor:** OpenAI-compatible
- **Operación:** Extracción de claims + comparación vs datos oficiales
- **Tokens input (estimado):** ~3,000-12,000 (claim extraction) + ~5,000-24,000 (comparison)
- **Tokens output (config):** max_tokens: 2,000 (claims) + 4,000 (comparison)
- **Temperatura:** 0.2
- **Formato respuesta:** json_object
- **Llamadas AI por request:** 2 (extract claims + compare)
- **Llamadas CENDOJ por request:** 0-2 (search + fetch)
- **Rate limit:** NO
- **Quota:** NO
- **Registra usage:** NO
- **Registra coste:** NO

---

## ENDPOINTS NO-AI (para diferenciación SEARCH vs AI_OPERATION)

| Endpoint | Tipo | Auth |
|---|---|---|
| GET /api/cendoj/search | SEARCH | NO |
| GET /api/cendoj/decision | SEARCH | NO |
| GET /api/cendoj/status | SEARCH | NO |
| POST /api/news/analyze | SEARCH (sin AI directo) | NO |
| POST /api/documents/upload | STORAGE | SÍ |
| Todas /api/workspace/* | CRUD | SÍ |
| Todas /api/alerts/* | CRUD + CRON | SÍ |
| POST /api/feedback | CRUD | SÍ |

---

## TAXONOMÍA DE OPERACIONES AI PROPUESTA

| operation_type | Endpoint | Descripción |
|---|---|---|
| judgment_summary | /api/cendoj/summarize | Resumen de sentencia |
| judgment_comparison | /api/cendoj/compare | Comparación de 2 sentencias |
| proposition_analysis | /api/cendoj/proposition | Análisis de proposición jurídica |
| document_analysis | /api/documents/analyze | Análisis de documento legal |
| jurisprudence_classification | /api/documents/search-jurisprudence | Clasificación relación jurisprudencia |
| news_claim_extraction | /api/news/compare (step 1) | Extracción de afirmaciones |
| news_comparison | /api/news/compare (step 2) | Comparación noticia vs datos |

---

## HALLAZGOS CRÍTICOS

1. **CERO medición de costes.** Ningún endpoint registra tokens, modelo, proveedor, ni coste estimado.
2. **3 de 6 endpoints AI no requieren auth.** Cualquiera puede consumir AI gratis.
3. **Sin rate limit per-user.** Solo rate-limit genérico in-memory (no persistente).
4. **Variables AI dispersas.** Cada route handler define sus propias constantes AI_BASE_URL/AI_API_KEY/AI_MODEL.
5. **MiMo hardcoded.** Modelo y URL de MiMo no son configurables.
6. **Sin circuit breaker.** Si MiMo o OpenAI están down, se propagan errores 502 sin fallback.
7. **Sin idempotencia.** Re-peticiones duplicadas generan duplicados en DB y AI.
8. **Tokens del proveedor ignorados.** Las respuestas de la API incluyen `usage` pero se descartan.
# AI USAGE SCHEMA

**Fecha:** 2026-09-26
**Phase:** 01

---

## TABLA: ai_usage_log

```sql
CREATE TABLE "ai_usage_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "operation_type" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer,
  "cached_input_tokens" integer,
  "output_tokens" integer,
  "reasoning_tokens" integer,
  "total_tokens" integer,
  "cost_usd" text,
  "latency_ms" integer,
  "success" boolean NOT NULL DEFAULT true,
  "error_type" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

---

## ÍNDICES

| Índice | Columnas | Propósito |
|---|---|---|
| ai_usage_log_pkey | id | PK |
| idx_ai_usage_log_user_id | user_id | Queries por usuario |
| idx_ai_usage_log_created_at | created_at | Queries temporales |
| idx_ai_usage_log_operation_type | operation_type | Agrupar por operación |
| idx_ai_usage_log_provider_model | provider, model | Agrupar por proveedor/modelo |

---

## CAMPOS

| Campo | Tipo | Nullable | Descripción |
|---|---|---|---|
| id | uuid | NO | PK auto-generada |
| user_id | uuid | SÍ | FK a users. NULL = operación anónima (legacy). SET NULL on delete. |
| operation_type | text | NO | Tipo de operación AI (ver taxonomía) |
| provider | text | NO | Proveedor: "openai_compatible" o "mimo" |
| model | text | NO | Modelo usado: "gpt-4o-mini", "mimo-v2.5-pro", etc. |
| input_tokens | integer | SÍ | Tokens de input (prompt). NULL = proveedor no lo devuelve. |
| cached_input_tokens | integer | SÍ | Tokens cacheados del input. NULL = no disponible. |
| output_tokens | integer | SÍ | Tokens de output (completion). NULL = proveedor no lo devuelve. |
| reasoning_tokens | integer | SÍ | Tokens de reasoning (o1/o3). NULL = no aplicable. |
| total_tokens | integer | SÍ | Total de tokens. NULL = no disponible. |
| cost_usd | text | SÍ | Coste calculado en USD. String para precisión. NULL = no calculable. |
| latency_ms | integer | SÍ | Latencia de la llamada AI en ms. |
| success | boolean | NO | true = operación exitosa, false = error |
| error_type | text | SÍ | Tipo de error si success=false. NULL si success=true. |
| created_at | timestamptz | NO | Timestamp auto-generado |

---

## OPERATION TYPES

| Valor | Endpoint | Descripción |
|---|---|---|
| judgment_summary | /api/cendoj/summarize | Resumen de sentencia |
| judgment_comparison | /api/cendoj/compare | Comparación de sentencias |
| proposition_analysis | /api/cendoj/proposition | Análisis de proposición |
| document_analysis | /api/documents/analyze | Análisis de documento legal |
| jurisprudence_classification | /api/documents/search-jurisprudence | Clasificación de relación |
| news_claim_extraction | /api/news/compare (step 1) | Extracción de afirmaciones |
| news_comparison | /api/news/compare (step 2) | Comparación noticia vs datos |

---

## PROVIDERS

| Valor | Descripción |
|---|---|
| openai_compatible | API OpenAI-compatible (AI_BASE_URL) |
| mimo | Xiaomi MiMo API |

---

## SEGURIDAD

- **NO se almacena**: prompts, contenido jurídico, API keys, documentos
- **user_id**: SET NULL on delete (si se borra el usuario, el log permanece anónimo)
- **cost_usd**: almacenado como text para evitar problemas de precisión con floats
- **created_at**: timezone-aware para queries correctas entre zonas horarias
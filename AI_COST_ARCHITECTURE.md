# AI COST ARCHITECTURE

**Fecha:** 2026-09-26
**Phase:** 01

---

## ARQUITECTURA

```
┌──────────────────────────────────────────────────┐
│                   lib/ai/                         │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ types.ts │  │ config.ts│  │pricing.ts│       │
│  └──────────┘  └──────────┘  └──────────┘       │
│       │              │              │             │
│  ┌──────────┐  ┌──────────┐                      │
│  │safety.ts │  │ client.ts│                      │
│  └──────────┘  └──────────┘                      │
│                     │                             │
│               ┌─────┴─────┐                      │
│               │ index.ts  │                      │
│               │(barrel)   │                      │
│               └───────────┘                      │
└─────────────────────┬────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ 6 API    │ │ ai_usage │ │ admin/   │
    │ endpoints│ │ _log DB  │ │ ai-costs │
    └──────────┘ └──────────┘ └──────────┘
```

---

## FLUJO DE UNA LLAMADA AI

```
1. Endpoint recibe request
2. requireAuth() → userId
3. Endpoint construye system_prompt + user_message
4. Llama callAiJson({operation_type, user_id, ...})
5. client.ts:
   a. Resuelve provider (openai_compatible o mimo)
   b. Obtiene config (base_url, api_key, model)
   c. Valida límites de seguridad
   d. Hace fetch a /chat/completions
   e. Parsea usage real del proveedor
   f. Calcula coste via pricing.ts
   g. Registra en ai_usage_log (best-effort)
   h. Devuelve {data, usage, cost, provider, model, latency_ms}
6. Endpoint procesa resultado
7. Endpoint devuelve respuesta con _ai_usage metadata
```

---

## CENTRALIZACIÓN

### Antes (Phase 00)
Cada endpoint declaraba:
```typescript
const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
```
Y hacía su propio `fetch()` directamente.

### Después (Phase 01)
Un solo punto de entrada:
```typescript
import { callAiJson } from "@/lib/ai";
const result = await callAiJson({operation_type, user_id, ...});
```

---

## PROVIDER CONFIG

| Provider | Env Vars | Default |
|---|---|---|
| openai_compatible | AI_BASE_URL, AI_API_KEY, AI_MODEL | OpenAI/gpt-4o-mini |
| mimo | MIMO_BASE_URL, MIMO_API_KEY, MIMO_MODEL | xiaomimimo/mimo-v2.5-pro |

MiMo ya NO está hardcoded en los endpoints.
Ahora configurable via variables de entorno.

---

## USAGE PARSING

El cliente parsea automáticamente el campo `usage` de la respuesta del proveedor:

```typescript
{
  input_tokens: response.usage.prompt_tokens,
  cached_input_tokens: response.usage.prompt_tokens_details?.cached_tokens,
  output_tokens: response.usage.completion_tokens,
  reasoning_tokens: response.usage.completion_tokens_details?.reasoning_tokens,
  total_tokens: response.usage.total_tokens,
}
```

Si el proveedor no devuelve usage, los campos son `null` y el coste se marca como `estimated: true`.

---

## LOGGING

Cada llamada AI genera un registro en `ai_usage_log`:
- user_id, operation_type, provider, model
- input/cached/output/reasoning/total tokens
- cost_usd, latency_ms, success, error_type
- created_at (auto)

El logging es **best-effort**: si falla, no bloquea la operación AI.
El contenido jurídico NUNCA se almacena en el log.
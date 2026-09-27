# LIA Smart Assistant — Architecture

**Fecha:** 2026-09-27
**Alcance:** Nivel 1 completo + Nivel 2 inicial (read-only tools)

---

## Request Flow

```
Usuario escribe mensaje
  → LiaAssistant.tsx (frontend)
    → POST /api/lia/chat
      → requireAuth() → 401 si no autenticado
      → checkRateLimit() → 429 si excedido (20/min/usuario)
      → validateLiaRequest() → 400 si inválido
      → routeIntent() → clasificación determinista
        → HELP/CONTEXT_HELP/GREETING → Knowledge Base ($0)
        → SYSTEM_STATUS → getSystemStatus() tool ($0)
        → SEARCH_JURISPRUDENCE → searchJurisprudence() tool ($0)
        → GET_DECISION → getDecision() tool ($0)
        → LEGAL_BOUNDARY → respuesta predefinida ($0)
        → UNSUPPORTED → LLM (si LIA_SMART_CHAT_ENABLED)
      → respuesta JSON
    ← LiaAssistant muestra respuesta
```

---

## Intents

| Intent | Disparador | Fuente | Coste |
|---|---|---|---|
| `GREETING` | "hola", "buenos días" | predefined | $0 |
| `HELP` | "¿Qué es ROJ?", keywords FAQ/glosario | knowledge base | $0 |
| `CONTEXT_HELP` | "¿Qué hago aquí?", route-aware | knowledge base | $0 |
| `SYSTEM_STATUS` | "¿Funciona CENDOJ?" | tool: CENDOJ status | $0 |
| `SEARCH_JURISPRUDENCE` | "Busca sobre despido" | tool: CENDOJ search | $0 |
| `GET_DECISION` | "ROJ: STS 1234/2024" | tool: CENDOJ search | $0 |
| `LEGAL_BOUNDARY` | "¿Voy a ganar?" | predefined | $0 |
| `UNSUPPORTED` | todo lo demás | LLM | ~$0.0001 |

**~90% de interacciones se resuelven sin LLM ($0).**

---

## Knowledge Base

Fuente: `lib/help/help-content.ts`

- **8 HelpEntries**: search, compare, proposition, workspace, alerts, news-compare, documents, help-index
- **2 GlobalEntries**: ai-explainer, status-glossary
- **1 PrivacyEntry**: privacidad de documentos
- **12 FAQ items**: preguntas frecuentes reales
- **Glosario**: 17 términos (ROJ, ECLI, CENDOJ, SOURCE_FACT, etc.)
- **8 PageDescriptions**: descripción por ruta

**Correcciones aplicadas:**
- Workspace ya no dice "almacenado localmente en navegador" (usa backend/DB)
- Privacy ya no dice "no se almacenan permanentemente" (sí se almacenan en cuenta)

---

## Tools (Read-Only)

| Tool | Endpoint | Auth | Coste |
|---|---|---|---|
| `searchJurisprudence(query, filters?)` | CENDOJ API directo | no | $0 |
| `getDecision(roj)` | CENDOJ API directo | no | $0 |
| `getSystemStatus()` | CENDOJ API /status | no | $0 |

**NO implementadas (spec):**
- save_to_workspace
- create_alert
- delete/update/write/mutate

---

## Auth

- Patrón: `requireAuth()` de `lib/auth/guard.ts`
- Si no hay sesión → 401
- LIA nunca accede a datos sin usuario autenticado

---

## Security

- **Rate limit**: 20 mensajes/min/usuario (in-memory sliding window)
- **Input validation**: max 500 chars, no HTML/script injection, no DOM
- **Context whitelist**: solo rutas reconocidas, path traversal → "/"
- **Conversation limit**: max 20 mensajes en historial
- **Selection sanitization**: strings > 50 chars descartados
- **Prompt injection**: separación SYSTEM/PRODUCT/USER/TOOL en prompt
- **Legal guardrails**: regex patterns para rechazar predicciones/asesoramiento

---

## Legal Guardrails

LIA puede:
- Explicar funciones de JURELIA
- Explicar conceptos jurídicos generales
- Buscar jurisprudencia en CENDOJ
- Presentar fuentes con ROJ/ECLI/tribunal/fecha
- Explicar resultados

LIA NO puede:
- Predecir resultados de litigio
- Dar garantía jurídica
- Inventar sentencias, artículos, citas
- Hacerse pasar por abogado

---

## Quota

- `lia_chat` mapea a categoría `judgment_summary` (la más barata)
- HELP/search/status: no consume quota AI
- LLM calls: consumen quota según categoría

---

## Rate Limit

- Mecanismo: `lib/rate-limit.ts` (in-memory sliding window)
- Config: 20 mensajes/min por usuario
- Respuesta 429 limpia con `retry_after_ms`

---

## Feature Flags

| Flag | Default | Efecto |
|---|---|---|
| `NEXT_PUBLIC_LIA_ENABLED` | `true` | Avatar visible/invisible |
| `LIA_SMART_CHAT_ENABLED` | `true` | Backend inteligente activo/desactivado |

Si `LIA_SMART_CHAT_ENABLED=false`: avatar visible pero chat usa fallback genérico.

---

## Telemetry

Log servidor (console.log):
- `intent`: clasificación del router
- `route`: ruta actual del usuario
- `tool_used`: "cendoj" o null
- `duration_ms`: latencia total
- `success`: true/false

**NO se loggea contenido jurídico sensible.**

---

## Files

### Nuevos
- `lib/lia/knowledge.ts` — Knowledge base (FAQ, KB, glosario, page descriptions)
- `lib/lia/router.ts` — Router determinista de intención
- `lib/lia/tools.ts` — Tools read-only (CENDOJ)
- `lib/lia/prompts.ts` — System prompt, disclaimers, respuestas predefinidas
- `lib/lia/context.ts` — Validación de request, formateo de contexto
- `app/api/lia/chat/route.ts` — Endpoint central
- `tests/lia/router.test.ts` — Tests del router (18 tests)
- `tests/lia/knowledge.test.ts` — Tests de knowledge base (15 tests)
- `tests/lia/context.test.ts` — Tests de validación (11 tests)
- `tests/lia/security.test.ts` — Tests de seguridad (23 tests)

### Modificados
- `components/LiaAssistant.tsx` — sendMessage() conecta a /api/lia/chat
- `lib/help/help-content.ts` — Corregida info obsoleta (workspace localStorage)
- `lib/ai/types.ts` — Añadido `lia_chat` operation type
- `lib/quota/category-map.ts` — Mapeo lia_chat → judgment_summary

---

## Tests

**67 tests LIA**, **195 total**, **0 regresiones**.

Categorías:
- Router: 18 tests (HELP, CONTEXT_HELP, SEARCH, DECISION, STATUS, LEGAL, GREETING)
- Knowledge: 15 tests (FAQ, KB search, contextual help, glossary, routes)
- Context: 11 tests (validación, sanitización, formatPageContext)
- Security: 23 tests (input validation, prompt injection, legal guardrails, context whitelist, conversation limits)

---

## Cost Estimate

| Tipo | % de interacciones | Coste |
|---|---|---|
| Help/FAQ/Glosario | ~50% | $0 |
| Context help | ~20% | $0 |
| Search/Status tools | ~15% | $0 |
| Legal boundary | ~5% | $0 |
| LLM (UNSUPPORTED) | ~10% | ~$0.0001 |

**Coste estimado por usuario/día: <$0.001**

---

## Known Limitations

1. Rate limit es in-memory (no persiste entre serverless instances)
2. Conversación no se persiste en DB
3. LLM usa system+user single message (no multi-turn nativo)
4. No hay tool calling formal del LLM (routing es determinista)
5. No conecta operaciones AI caras (summarize, compare, proposition)

---

## Next Steps

1. Persistir conversación en DB (con opt-in del usuario)
2. Tool calling real del LLM para operaciones complejas
3. Conectar summarize/compare/proposition desde chat
4. Rate limit distribuido (Upstash Redis)
5. Streaming de respuestas largas
6. Feedback de calidad de respuestas de LIA
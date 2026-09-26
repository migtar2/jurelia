# CURRENT ARCHITECTURE

**Fecha:** 2026-09-26
**Commit:** 1b8b04a

---

## DIAGRAMA DE ARQUITECTURA

```
┌─────────────────────────────────────────────────────┐
│                    VERCEL                            │
│  ┌──────────────────────────────────────────────┐   │
│  │           Next.js 16 (App Router)             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │  │ Pages    │  │ API      │  │Middleware │   │   │
│  │  │ (9 rutas)│  │ (36 rts) │  │(headers) │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘   │   │
│  │                                              │   │
│  │  ┌──────────────────────────────────────┐   │   │
│  │  │ lib/                                 │   │   │
│  │  │  auth/  db/  cendoj/  news/  alerts/ │   │   │
│  │  │  workspace/  matching/  email/       │   │   │
│  │  └──────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────┘   │
│         │              │              │              │
│    ┌────┴────┐   ┌─────┴─────┐  ┌────┴────┐        │
│    │ Neon DB │   │ VPS API   │  │ AI APIs │        │
│    │(Postgres│   │(CENDOJ)   │  │         │        │
│    └─────────┘   └───────────┘  └─────────┘        │
└─────────────────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐   ┌─────┴─────┐  ┌────┴────────────┐
    │  Neon   │   │ 31.70.    │  │ OpenAI-compat   │
    │ Project │   │ 136.34    │  │ + MiMo API      │
    │ jurelia │   │ Docker    │  │                 │
    └─────────┘   │ Caddy     │  └─────────────────┘
                  └───────────┘
```

---

## FLUJO DE DATOS

### Búsqueda jurisprudencial (NO AI)
```
Browser → GET /api/cendoj/search?query=...
        → fetch(CENDOJ_API/api/search)
        → VPS CENDOJ → poderjudicial.es
        → JSON results → Browser
```

### Resumen AI de sentencia
```
Browser → POST /api/cendoj/summarize {roj, resumen, pdf_url}
        → [si pdf_url] fetch(CENDOJ_API/api/decision) → texto PDF
        → fetch(AI_BASE_URL/chat/completions) → GPT/MiMo
        → JSON structured summary → Browser
```

### Análisis de documento
```
Browser → POST /api/documents/upload → Neon DB (document record)
        → POST /api/documents/analyze {document_id, extracted_text}
        → requireAuth() → ownership check
        → fetch(MiMo API) → structured analysis
        → Neon DB (document_analyses)
        → Browser
```

### Investigación jurisprudencial desde documento
```
Browser → POST /api/documents/search-jurisprudence {document_id, analysis_id}
        → requireAuth() → ownership check
        → Load analysis from DB
        → Para cada issue (max 5):
          → Generar queries balanceadas (supporting + contrary)
          → Buscar en CENDOJ (max 5 candidatos por issue)
          → Para cada candidato: clasificar vía MiMo (1 llamada AI)
        → Gap analysis
        → Neon DB (document_research_results)
        → Browser
```

---

## PATRONES DE CÓDIGO

### Auth Pattern
```typescript
// Cada API route protegido:
const auth = await requireAuth();
if (auth.error) return auth.error;
// auth.user.userId, auth.user.email
```

### AI Call Pattern (OpenAI-compatible)
```typescript
const aiRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${AI_API_KEY}`,
  },
  body: JSON.stringify({
    model: AI_MODEL,
    messages: [...],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  }),
  signal: AbortSignal.timeout(60_000),
});
```

### AI Call Pattern (MiMo)
```typescript
const response = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.MIMO_API_KEY}`,
  },
  body: JSON.stringify({
    model: "mimo-v2.5-pro",
    messages: [...],
    temperature: 0.1,
    max_tokens: 4000,
  }),
});
```

### DB Pattern (Drizzle)
```typescript
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const [doc] = await db.select().from(documents).where(...).limit(1);
```

---

## DEPENDENCIAS CRÍTICAS

| Servicio | Impacto si cae | Fallback |
|---|---|---|
| Neon DB | App completa offline | Ninguno |
| VPS CENDOJ | Búsquedas fallan | Cache local? NO |
| AI_BASE_URL | Resúmenes/comparaciones fallan | Error 502 |
| MiMo API | Document analysis falla | Error 502 |
| Resend | Alertas no se envían | Silencioso |

---

## DEUDA TÉCNICA IDENTIFICADA

1. **Variables AI no centralizadas** — cada route handler redeclara AI_BASE_URL, AI_API_KEY, AI_MODEL
2. **MiMo hardcoded** — URL y modelo no configurables via env
3. **Sin test framework** — 0 tests automatizados
4. **Rate limit in-memory** — no persistente, no per-user
5. **Sin error boundary** — errores AI se propagan como 502 genéricos
6. **Sin logging estructurado** — solo console.log/console.error
7. **Sin health check** — no hay endpoint /api/health
8. **Middleware no protege rutas** — auth es per-route, no centralizado
9. **Sin CSRF** — POST routes no verifican origin
10. **PDF fetch no cached** — cada solicitud re-descarga el PDF
# LIA — CURRENT CAPABILITY AUDIT

> **Fecha**: 2026-09-27
> **Alcance**: Solo análisis. Cero cambios funcionales.
> **Metodología**: Inspección directa del código fuente en `D:\app\cendoj\cendoj-poc`.

---

## 1. Executive Summary

**LIA no tiene inteligencia alguna.** Es un avatar animado con un chat de juguete. El componente `LiaAssistant.tsx` renderiza una animación Lottie en un canvas flotante, gestiona estados visuales (idle, blink, hello, thinking, talking), permite movimiento autónomo por la pantalla, y muestra un panel de chat que responde siempre con la misma frase hardcodeada tras un timer de1.6 segundos.

**No hay ninguna llamada a LLM, ninguna consulta a API, ningún acceso a datos del usuario, ninguna consciencia de la ruta, del documento abierto, ni de la sesión.**

Sin embargo, JURELIA tiene una infraestructura AI robusta ya construida: cliente centralizado con2 proveedores (MiMo, OpenAI-compatible),7 operaciones tipadas, sistema de quotas, pricing por token, safety limits, y logging de usage. Todo esto está listo para ser aprovechado por LIA.

---

## 2. What LIA Does Today

### 2.1 Componente: `components/LiaAssistant.tsx` (795 líneas)

| Funcionalidad | Estado | Detalle |
|---|---|---|
| Render Lottie | ✅ | Canvas 500×620, dotlottie-web 0.77.1, WASM self-hosted |
| Estados visuales | ✅ | idle (0-59), blink (60-89), hello (90-149), thinking (150-209), talking (210-299) |
| Movimiento | ✅ | HOME bottom-left (left:24, bottom:24), moveLiaTo(), moveHome(onArrival?) |
| Auto-move | ✅ | 25-60s intervalos, 40% esquina opuesta, 30% random, 30% home |
| Click → HOME → chat | ✅ | Si no está en HOME, mueve primero, luego abre chat |
| Chat panel | ✅ | Panel fijo left:24, ancho 340px, scroll, cierre con Escape |
| Accesibilidad | ✅ | role="button", aria-label, tabIndex, prefers-reduced-motion |
| Feature flags | ✅ | NEXT_PUBLIC_LIA_ENABLED, NEXT_PUBLIC_LIA_AUTO_MOVE |
| Pausa en background | ✅ | visibilitychange → pause/play |
| QA panel (dev) | ✅ | Botones para estados, mover, auto-move toggle |

### 2.2 Lo que LIA NO hace

| Capacidad | Estado |
|---|---|
| Llamar a cualquier LLM | ❌ CERO llamadas |
| Consultar CENDOJ | ❌ |
| Consultar la DB | ❌ |
| Saber la ruta actual | ❌ |
| Saber qué usuario está logueado | ❌ |
| Saber qué documento está abierto | ❌ |
| Dar respuestas reales | ❌ |
| Mantener conversación | ❌ |
| Recordar nada | ❌ |
| Ejecutar acciones | ❌ |
| Conectar con ningún endpoint | ❌ |

### 2.3 El "chat" de LIA

```typescript
// sendMessage — LÍNEA336-358
setMessages((prev) => [...prev, { role: "user", text: clean }]);
applyState("thinking");

setTimeout(() => {
  applyState("talking");
  setMessages((prev) => [...prev, {
    role: "lia",
    text: "Entendido. Déjame revisar la información disponible y te respondo en un momento.",
  }]);
}, 1600);

setTimeout(() => { applyState("idle"); }, 4600);
```

**Cualquier mensaje del usuario produce SIEMPRE la misma respuesta** tras1.6s de "thinking" y3s de "talking". No hay conexión con ningún backend.

### 2.4 Base de conocimiento de LIA

**No existe.** No hay ningún archivo de knowledge base, system prompt, RAG index, ni embeddings asociados a LIA.

---

## 3. What LIA Can Answer Today

**Nada.** LIA puede mostrar la animación de "thinking" y "talking" pero la respuesta es siempre la misma cadena hardcodeada. No puede responder ninguna pregunta real sobre JURELIA, jurisprudencia, ni cualquier otro tema.

---

## 4. What LIA Cannot Do Today

- No puede explicar qué es JURELIA
- No puede guiar al usuario por la interfaz
- No puede buscar jurisprudencia
- No puede resumir sentencias
- No puede comparar resoluciones
- No puede analizar documentos
- No puede gestionar el workspace
- No puede crear alertas
- No puede saber en qué página está el usuario
- No puede acceder a datos del usuario autenticado

---

## 5. JURELIA Capability Map

### 5.1 Tabla completa de funcionalidades

| FUNCIÓN | RUTA UI | API | AUTH | AI | DATOS | QUÉ HACE |
|---|---|---|---|---|---|---|
| **Buscar jurisprudencia** | `/` | GET `/api/cendoj/search` | ✅ | ❌ | CENDOJ | Búsqueda por texto, ROJ, ECLI, filtros de tribunal/fecha |
| **Encontrar sentencia** | `/` | (usa search) | ✅ | ❌ | CENDOJ | Extrae metadatos de URL de noticia y busca en CENDOJ |
| **Resumir sentencia** | (inline) | POST `/api/cendoj/summarize` | ✅ | ✅ OpenAI-compat | CENDOJ+AI | Genera resumen estructurado: hechos, cuestión, razonamiento, fallo |
| **Comparar sentencias** | `/compare` | POST `/api/cendoj/compare` | ✅ | ✅ OpenAI-compat | CENDOJ+AI | Informe comparativo de2 resoluciones:8 secciones |
| **Proposición jurídica** | `/proposition` | POST `/api/cendoj/proposition` | ✅ | ✅ OpenAI-compat (2 calls) | CENDOJ+AI | Contrasta una tesis contra jurisprudencia: clasifica apoyo/contradicción |
| **Análisis de noticias** | `/news-compare` | POST `/api/news/compare` | ✅ | ✅ OpenAI-compat (2 calls) | Web+CENDOJ+AI | Extrae afirmaciones de noticia, contrasta con resolución real |
| **Análisis de noticias** | `/news-compare` | POST `/api/news/analyze` | ✅ | ❌ | Web+CENDOJ | Pipeline: fetch→extract→metadata→search→match |
| **Subir documento** | `/documents` | POST `/api/documents/upload` | ✅ | ❌ | DB | Upload PDF/DOCX/TXT, extrae texto |
| **Analizar documento** | `/documents` | POST `/api/documents/analyze` | ✅ | ✅ MiMo | DB+AI | Extrae cuestiones, argumentos, citas del documento |
| **Buscar jurisprudencia relacionada** | `/documents` | POST `/api/documents/search-jurisprudence` | ✅ | ✅ MiMo (N calls) | DB+CENDOJ+AI | Para cada cuestión extraída, busca y clasifica jurisprudencia |
| **Workspace** | `/workspace` | 12+ endpoints | ✅ | ❌ | DB | Carpetas, etiquetas, notas, búsquedas guardadas, documentos guardados |
| **Alertas** | `/alerts` | CRUD+execute | ✅ | ❌ | DB+CENDOJ | Monitoreo periódico de nuevas resoluciones |
| **Autenticación** | `/auth/*` | login/register/me/logout | ✅ | ❌ | DB | Email+password+bcrypt, cookie sessions |
| **Help** | `/help` | (estático) | ❌ | ❌ | Hardcoded |8 entradas,12 FAQ, glosario de estados |
| **Feedback** | (widget) | POST `/api/feedback` | ✅ | ❌ | DB | Reportes de usuarios |
| **Admin** | `/admin/feedback` | GET/POST | ✅ | ❌ | DB | Ver feedback, gestionar planes |
| **Quota/Plans** | (middleware) | `/api/usage` | ✅ | ❌ | DB | Sistema free/pro/unlimited con quotas por categoría |
| **Status CENDOJ** | (inline) | GET `/api/cendoj/status` | ✅ | ❌ | CENDOJ | Health check del backend CENDOJ |

### 5.2 Módulos principales

1. **Búsqueda** (`/`): Consulta CENDOJ, filtros avanzados, modo "encontrar sentencia"
2. **Comparación** (`/compare`): Dos resoluciones → informe estructurado8 secciones
3. **Proposición** (`/proposition`): Tesis → búsqueda CENDOJ → clasificación apoyo/contradicción
4. **Noticias** (`/news-compare`): Artículo → extracción → matching CENDOJ → contraste
5. **Documentos** (`/documents`): Upload → análisis → búsqueda jurisprudencia relacionada
6. **Workspace** (`/workspace`): Biblioteca personal con carpetas, tags, notas
7. **Alertas** (`/alerts`): Monitoreo periódico con email
8. **Help** (`/help`): Centro de ayuda estático

---

## 6. Existing AI Architecture

### 6.1 Infraestructura AI (ya construida)

| Componente | Archivo | Estado |
|---|---|---|
| Cliente centralizado | `lib/ai/client.ts` | ✅ Completo |
| Configuración proveedores | `lib/ai/config.ts` | ✅ Completo |
| Tipos y operaciones | `lib/ai/types.ts` | ✅ Completo |
| Pricing | `lib/ai/pricing.ts` | ✅ Completo |
| Safety limits | `lib/ai/safety.ts` | ✅ Completo |
| Quota engine | `lib/quota/` | ✅ Completo |

### 6.2 Proveedores configurados

| Proveedor | Base URL | Modelo por defecto | Uso actual |
|---|---|---|---|
| `openai_compatible` | `AI_BASE_URL` (default: OpenAI) | `gpt-4o-mini` | Summarize, Compare, Proposition, News |
| `mimo` | `MIMO_BASE_URL` (default: xiaomimimo.com) | `mimo-v2.5-pro` | Document analysis, Jurisprudence classification |

### 6.3 Operaciones AI registradas

| Operación | Proveedor | Modelo | Endpoint |
|---|---|---|---|
| `judgment_summary` | openai_compatible | gpt-4o-mini | POST `/api/cendoj/summarize` |
| `judgment_comparison` | openai_compatible | gpt-4o-mini | POST `/api/cendoj/compare` |
| `proposition_analysis` | openai_compatible | gpt-4o-mini | POST `/api/cendoj/proposition` |
| `document_analysis` | mimo | mimo-v2.5-pro | POST `/api/documents/analyze` |
| `jurisprudence_classification` | mimo | mimo-v2.5-pro | POST `/api/documents/search-jurisprudence` |
| `news_claim_extraction` | openai_compatible | gpt-4o-mini | POST `/api/news/compare` (step1) |
| `news_comparison` | openai_compatible | gpt-4o-mini | POST `/api/news/compare` (step2) |

### 6.4 Safety limits

```typescript
MAX_INPUT_CHARS: 50_000
MAX_OUTPUT_TOKENS: 8_000
MAX_TIMEOUT_MS: 120_000
MAX_AI_CALLS_PER_REQUEST: 30
MAX_RETRIES: 1
```

### 6.5 Base de datos (16 tablas)

| Tabla | Propósito |
|---|---|
| `users` | Usuarios (email, password_hash) |
| `user_subscriptions` | Planes (free/pro/unlimited) |
| `usage_reservations` | Quota enforcement |
| `saved_decisions` | Resoluciones guardadas en workspace |
| `folders` / `folder_decisions` | Carpetas del workspace |
| `tags` / `decision_tags` | Etiquetas |
| `notes` | Notas privadas por resolución |
| `saved_searches` | Búsquedas guardadas |
| `alerts` / `alert_executions` / `alert_seen_decisions` | Sistema de alertas |
| `email_deliveries` | Email de alertas |
| `news_analyses` | Análisis de noticias guardados |
| `documents` / `document_analyses` / `document_research_results` | Document Intelligence |
| `beta_feedback` | Feedback de usuarios |
| `ai_usage_log` | Logging de usage AI |

---

## 7. Knowledge Base Requirements

### 7.1 Conocimiento estático necesario

LIA necesita saber todo lo que `lib/help/help-content.ts` ya contiene:

- **8 HelpEntries**: search, compare, proposition, workspace, alerts, news-compare, documents, help-index
- **2 GlobalEntries**: ai-explainer, status-glossary
- **1 PrivacyEntry**: privacidad de documentos
- **12 FAQ items**: preguntas frecuentes reales

**Este contenido ya existe y es exhaustivo.** Es la base de conocimiento perfecta para LIA.

### 7.2 Conocimiento de pantalla necesario

| Ruta | Módulo | Qué debería saber LIA |
|---|---|---|
| `/` | Búsqueda | "Estás en el buscador de jurisprudencia. Puedes buscar por texto libre, ROJ, ECLI..." |
| `/compare` | Comparación | "Aquí puedes comparar dos resoluciones. Primero guárdalas desde los resultados..." |
| `/proposition` | Proposición | "Escribe tu tesis jurídica y JURELIA la contrastará con jurisprudencia..." |
| `/news-compare` | Noticias | "Pega la URL de una noticia jurídica para verificar su precisión..." |
| `/documents` | Documentos | "Sube un PDF o Word para extraer cuestiones y buscar jurisprudencia..." |
| `/workspace` | Workspace | "Tu biblioteca personal. Organiza resoluciones en carpetas y etiquetas..." |
| `/alerts` | Alertas | "Configura alertas para recibir notificaciones de nuevas resoluciones..." |
| `/help` | Ayuda | "Centro de ayuda completo de JURELIA..." |

### 7.3 Conocimiento de objeto necesario

Cuando el usuario tiene algo seleccionado/abierto, LIA podría saber:
- ROJ, ECLI, órgano, fecha de la resolución
- Tipo de documento (DEMANDA, SENTENCIA, etc.)
- Cuestiones extraídas
- Estado del análisis

**Sin enviar información sensible innecesariamente.**

---

## 8. Context Architecture

### 8.1 Opciones evaluadas

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **A. System prompt gigante** | Todo JURELIA en el prompt | Simple | Caro, se desborda, no escala |
| **B. RAG documental** | Embeddings de help content | Preciso | Complejo, necesita infra |
| **C. Route-aware help** | Conocimiento por ruta | Simple, barato | Limitado a帮助 estática |
| **D. Tool calling** | Llama a APIs existentes | Potente | Complejo, latencia |
| **E. Híbrida** | Combina C+D | Mejor de ambos mundos | Más trabajo inicial |

### 8.2 Recomendación: Opción E — Híbrida

```
SYSTEM PROMPT pequeño (~500 tokens)
  + "Eres LIA, asistente de JURELIA. Facilitas investigación jurídica.
     No sustituyes revisión profesional. Responde en español."

KNOWLEDGE BASE por ruta (cargada dinámicamente)
  + HelpEntry relevante a la ruta actual
  + FAQ filtrado por keywords

CONTEXTO DE PANTALLA (inyectado por LiaAssistant)
  + { route: "/compare", module: "comparison" }
  + { selectedDecisions: [...], chatHistory: [...] }

TOOLS (para operaciones reales)
  + search_jurisprudence(query)
  + summarize_decision(roj)
  + compare_decisions(roj_a, roj_b)
  + get_help(query)
  + get_current_context()
```

---

## 9. Tool Catalogue

### 9.1 Herramientas propuestas

| Tool | Endpoint existente | Necesita wrapper | Auth | Riesgo | Coste |
|---|---|---|---|---|---|
| `get_help(query)` | `lib/help/help-content.ts` | No | No | Ninguno | $0 |
| `search_jurisprudence(query, filters)` | GET `/api/cendoj/search` | Sí (server action) | Sí | Bajo | $0 |
| `summarize_decision(roj, resumen?)` | POST `/api/cendoj/summarize` | Sí | Sí | Medio | ~$0.002 |
| `compare_decisions(roj_a, roj_b)` | POST `/api/cendoj/compare` | Sí | Sí | Medio | ~$0.005 |
| `analyze_proposition(text)` | POST `/api/cendoj/proposition` | Sí | Sí | Alto | ~$0.008 |
| `analyze_document(document_id)` | POST `/api/documents/analyze` | Sí | Sí | Alto | ~$0.003 |
| `search_related_jurisprudence(doc_id, issue)` | POST `/api/documents/search-jurisprudence` | Sí | Sí | Alto | ~$0.01+ |
| `get_workspace()` | GET `/api/workspace/*` | No | Sí | Bajo | $0 |
| `save_to_workspace(roj, folder?)` | POST `/api/workspace/decisions/save` | No | Sí | Bajo | $0 |
| `list_alerts()` | GET `/api/alerts` | No | Sí | Bajo | $0 |
| `create_alert(search_id, freq)` | POST `/api/alerts` | No | Sí | Medio | $0 |
| `get_current_context()` | (nuevo) | Sí | Sí | Bajo | $0 |
| `get_system_status()` | GET `/api/cendoj/status` | No | Sí | Bajo | $0 |

### 9.2 Herramientas que NO deben exponerse directamente

- `POST /api/documents/upload` — Requiere archivo, no texto
- `POST /api/news/analyze` — Pipeline complejo, mejor como tool compuesto
- Endpoints admin — Solo para administradores

---

## 10. Security and Privacy

### 10.1 Riesgos identificados

| Riesgo | Nivel | Mitigación |
|---|---|---|
| **Prompt injection** | ALTO | El chat de LIA recibiría texto libre del usuario. El system prompt debe ser robusto. Los documentos ya tienen protección (marcado como `DOCUMENTO_SIN_CONFIANZA`). |
| **Cross-user data** | ALTO | LIA NUNCA debe acceder a datos de otro usuario. Todos los endpoints existentes ya verifican ownership. |
| **IDOR** | MEDIO | Los tools deben pasar siempre `userId` de la sesión, nunca aceptar IDs del usuario directamente sin ownership check. |
| **Alucinaciones jurídicas** | ALTO | LIA no debe inventar sentencias, artículos ni citas. Debe usar CENDOJ como fuente. Los prompts existentes ya tienen esta regla. |
| **Exposición de documentos** | MEDIO | Los textos de documentos se envían al proveedor AI. Los documentos confidenciales no deben usarse sin consentimiento. |
| **RAG poisoning** | BAJO | La knowledge base es estática (help content), no acepta inputs del usuario. |
| **Tool abuse** | MEDIO | Limitar frecuencia de llamadas AI. El sistema de quotas ya existe. |
| **Acciones destructivas** | BAJO | Las tools propuestas son read-only o de escritura limitada (guardar, crear alerta). |

### 10.2 Controles necesarios

1. **System prompt robusto** contra injection
2. **Ownership verification** en todos los tools
3. **Rate limiting** por usuario para llamadas AI a través de LIA
4. **Confirmación del usuario** antes de acciones con efectos (crear alerta, guardar en workspace)
5. **Logging** de todas las interacciones de LIA para auditoría
6. **Disclaimers** automáticos: "Este análisis es orientativo y no constituye asesoramiento jurídico"

---

## 11. Legal Guardrails

### 11.1 Reglas obligatorias para LIA

1. **Distinguir información jurídica de asesoramiento**: LIA explica, no aconseja
2. **Citar fuentes**: Cuando mencione jurisprudencia, citar ROJ/ECLI/tribunal/fecha
3. **No inventar**: Nunca inventar sentencias, artículos, citas ni datos
4. **Mostrar incertidumbre**: "No estoy seguro", "Esto debería verificarse"
5. **Usar CENDOJ como fuente**: Para jurisprudencia, siempre consultar CENDOJ
6. **Disclaimer persistente**: "JURELIA facilita investigación pero no sustituye revisión profesional"

### 11.2 Preguntas que debe rechazar/reformular

- "¿Ganaré este caso?" → "No puedo predecir resultados. Puedo ayudarte a encontrar jurisprudencia relevante."
- "Dame asesoramiento jurídico" → "No ofrezco asesoramiento. Puedo ayudarte a investigar."
- "¿Qué dice el juez sobre X?" → Consultar CENDOJ, no inventar.

---

## 12. Model Strategy

### 12.1 Análisis de modelos actuales

| Modelo | Precio input/1M | Precio output/1M | Uso recomendado |
|---|---|---|---|
| `gpt-4o-mini` | $0.15 | $0.60 | Help, routing, resúmenes simples |
| `mimo-v2.5-pro` | $0.435 | $0.87 | Análisis complejo de documentos |
| `mimo-v2.5` | $0.14 | $0.28 | Tareas simples de bajo coste |

### 12.2 Routing por complejidad propuesto

```
Pregunta simple de ayuda → NO usar LLM
  "¿Dónde está el botón de buscar?"
  → Knowledge base estática + route context
  → Coste: $0

Pregunta contextual → Modelo pequeño (mimo-v2.5 o gpt-4o-mini)
  "¿Qué puedo hacer en esta pantalla?"
  → System prompt + route help entry
  → Coste: ~$0.0001

Búsqueda jurisprudencial → Tool call (sin LLM adicional)
  "Busca sobre despido disciplinario"
  → search_jurisprudence tool → mostrar resultados
  → Coste: $0 (la búsqueda no usa AI)

Resumen/comparación/análisis → Modelo existente por endpoint
  "Resume esta sentencia"
  → summarize_decision tool → usar endpoint existente
  → Coste: ~$0.002

Conversación compleja → Modelo intermedio
  "Explícame la diferencia entre estas dos líneas jurisprudenciales"
  → Contexto + tool results + modelo
  → Coste: ~$0.001
```

### 12.3 Recomendación

**No usar un modelo caro para preguntas simples.** El routing por complejidad es clave:

1. **Nivel0 (help estático)**: $0 — Responder desde knowledge base sin LLM
2. **Nivel1 (help contextual)**: ~$0.0001 — mimo-v2.5 parafraseando help content
3. **Nivel2 (tool calling)**: ~$0.001-0.01 — Usar endpoints existentes, LLM solo para orquestar
4. **Nivel3 (análisis profundo)**: ~$0.005-0.02 — mimo-v2.5-pro para análisis complejo

---

## 13. Cost Estimates

### 13.1 Coste por tipo de interacción

| Tipo | Modelo | Input tokens | Output tokens | Coste estimado |
|---|---|---|---|---|
| Pregunta simple ("¿qué es esto?") | Ninguno | 0 | 0 | **$0** |
| Help contextual | mimo-v2.5 | ~500 | ~200 | **$0.00013** |
| Búsqueda jurisprudencial | Tool only | 0 | 0 | **$0** |
| Resumen de sentencia | gpt-4o-mini | ~3000 | ~800 | **$0.00093** |
| Comparación | gpt-4o-mini | ~6000 | ~2000 | **$0.0021** |
| Proposición | gpt-4o-mini | ~5000 | ~1500 | **$0.00165** |
| Análisis de documento | mimo-v2.5-pro | ~4000 | ~2000 | **$0.00348** |
| Búsqueda jurisprudencia relacionada | mimo-v2.5-pro | ~3000 | ~500 (×N issues) | **$0.00174** × N |

### 13.2 Proyección de costes

**Supuestos**: Usuario medio hace5 interacciones/día:2 help +2 tool +1 análisis.

| Usuarios | Interacciones/día | Help ($0) | Tool ($0.001) | Análisis ($0.003) | **Total/mes** |
|---|---|---|---|---|---|
| 100 | 500 | $0 | $0.20/día | $0.30/día | **~$15/mes** |
| 1,000 | 5,000 | $0 | $2/día | $3/día | **~$150/mes** |
| 10,000 | 50,000 | $0 | $20/día | $30/día | **~$1,500/mes** |

**Conclusión**: El coste es muy bajo porque la mayoría de interacciones pueden resolverse sin LLM (help estático) o con tools existentes.

---

## 14. 40+ Example Questions

### 14.1 Preguntas de ayuda (sin LLM, knowledge base)

| # | PREGUNTA | RESPUESTA | FUENTE | LLM | TOOL | AUTH |
|---|---|---|---|---|---|---|
|1| "¿Qué es JURELIA?" | Observatorio de jurisprudencia del CENDOJ | help-content | ❌ | ❌ | ❌ |
|2| "¿Qué puedo hacer aquí?" | Depende de la ruta actual | route help | ❌ | ❌ | ❌ |
|3| "¿Cómo busco una sentencia?" | Escribe en el campo, usa filtros... | search entry | ❌ | ❌ | ❌ |
|4| "¿Qué es el ROJ?" | Identificador nacional de resoluciones | FAQ-10 | ❌ | ❌ | ❌ |
|5| "¿Qué diferencia hay entre ROJ y ECLI?" | ROJ=nacional, ECLI=europeo | FAQ-10 | ❌ | ❌ | ❌ |
|6| "¿Cómo subo un documento?" | En /documents, arrastra o selecciona | documents entry | ❌ | ❌ | ❌ |
|7| "¿Qué hace Document Intelligence?" | Extrae cuestiones, argumentos, citas | documents entry | ❌ | ❌ | ❌ |
|8| "¿Dónde están mis documentos?" | En tu workspace, sección documentos | workspace entry | ❌ | ❌ | ❌ |
|9| "¿Cómo creo una alerta?" | Guarda búsqueda, luego crea alerta | alerts entry | ❌ | ❌ | ❌ |
|10| "¿Qué guarda JURELIA de mí?" | Búsquedas, alertas, workspace | privacy entry | ❌ | ❌ | ❌ |
|11| "¿Por qué no encuentro esta sentencia?" | Comprueba filtros, prueba términos más generales | FAQ-8 | ❌ | ❌ | ❌ |
|12| "¿Está funcionando CENDOJ?" | Consultar status | status-glossary | ❌ | ✅ | ✅ |
|13| "¿Qué significa AI_GENERATED?" | Contenido generado por IA, verificar | status-glossary | ❌ | ❌ | ❌ |
|14| "¿Qué significa SOURCE_FACT?" | Extraído directamente de la fuente | status-glossary | ❌ | ❌ | ❌ |
|15| "¿Puedo usar JURELIA para documentos confidenciales?" | Evalúa riesgos, consulta privacidad | FAQ-4 | ❌ | ❌ | ❌ |
|16| "¿Cuántas resoluciones puedo guardar?" |500 por cuenta | FAQ-5 | ❌ | ❌ | ❌ |
|17| "¿Las alertas envían email?" | No en esta versión | FAQ-6 | ❌ | ❌ | ❌ |
|18| "¿Puedo exportar resultados?" | Sí, como texto o JSON | FAQ-7 | ❌ | ❌ | ❌ |
|19| "¿JURELIA funciona con todas las jurisdicciones?" | Sí, todas las del CENDOJ | FAQ-9 | ❌ | ❌ | ❌ |
|20| "¿Cómo reporto un error?" | Formulario de contacto o email | FAQ-12 | ❌ | ❌ | ❌ |

### 14.2 Preguntas contextuales (modelo pequeño)

| # | PREGUNTA | RESPUESTA | FUENTE | LLM | TOOL | AUTH |
|---|---|---|---|---|---|---|
|21| "¿Qué hago en esta pantalla?" | Explicación de la función actual | route+help | ✅ | ❌ | ❌ |
|22| "¿Cómo funciona la comparación?" | Paso a paso desde /compare | compare entry | ✅ | ❌ | ❌ |
|23| "Explícame los estados de procedencia" | FULL_TEXT, OFFICIAL_SUMMARY, METADATA_ONLY | status-glossary | ✅ | ❌ | ❌ |
|24| "¿Qué filtro me recomiendas para buscar despido?" | Sugerencias de filtros | search entry+contexto | ✅ | ❌ | ❌ |
|25| "¿Cuál es la diferencia entre Comparar y Proposición?" | Comparar=2 resoluciones, Proposición=tesis vs jurisprudencia | help entries | ✅ | ❌ | ❌ |

### 14.3 Preguntas con tool calling (endpoints existentes)

| # | PREGUNTA | RESPUESTA | FUENTE | LLM | TOOL | AUTH |
|---|---|---|---|---|---|---|
|26| "Busca jurisprudencia sobre despido disciplinario" | Resultados de CENDOJ | /api/cendoj/search | ❌ | ✅ | ✅ |
|27| "Resume esta sentencia" (con ROJ seleccionado) | Resumen estructurado | /api/cendoj/summarize | ✅ | ✅ | ✅ |
|28| "Compárame estas dos sentencias" | Informe comparativo | /api/cendoj/compare | ✅ | ✅ | ✅ |
|29| "¿Qué dice el CENDOJ sobre pensión compensatoria?" | Búsqueda+resumen | search+summarize | ✅ | ✅ | ✅ |
|30| "Analiza este documento" (doc subido) | Cuestiones, argumentos, citas | /api/documents/analyze | ✅ | ✅ | ✅ |
|31| "Busca jurisprudencia contraria a este argumento" | Clasificación CONTRADICTS | /api/documents/search-jurisprudence | ✅ | ✅ | ✅ |
|32| "¿Qué alertas tengo configuradas?" | Lista de alertas | /api/alerts | ❌ | ✅ | ✅ |
|33| "¿Cuántas búsquedas he guardado?" | Conteo del workspace | /api/workspace/searches | ❌ | ✅ | ✅ |
|34| "Guarda esta búsqueda en mi workspace" | Confirmación | /api/workspace/decisions/save | ❌ | ✅ | ✅ |
|35| "Verifica esta noticia sobre la STS 1234/2024" | Análisis de precisión | /api/news/compare | ✅ | ✅ | ✅ |

### 14.4 Preguntas que requieren contexto de pantalla

| # | PREGUNTA | CONTEXTO NECESARIO | RESPUESTA |
|---|---|---|---|
|36| "¿Qué significan estos resultados?" | Ruta: /, resultados actuales | Explicar los campos: ROJ, ECLI, órgano, ponente... |
|37| "¿Por qué esta sentencia tiene nivel METADATA_ONLY?" | Contexto de comparación | "No se encontró texto completo en CENDOJ, solo metadatos" |
|38| "Compáralas" |2 sentencias seleccionadas en /compare | Llamar a compare_decisions con los ROJ |
|39| "Busca jurisprudencia sobre esto" | Documento abierto en /documents | Usar cuestiones extraídas como query |
|40| "¿Qué puedo hacer con este documento?" | Documento analizado en workspace | Mostrar opciones: buscar relacionada, exportar, notas |
|41| "¿Esta sentencia apoya mi argumento?" | Proposición+sentencia en pantalla | Analizar relación |
|42| "Resume lo que dice esta noticia" | Noticia en /news-compare | Extraer puntos clave del artículo |
|43| "¿Es fiable este titular?" | Análisis de noticia completado | Explicar headline_accuracy |
|44| "Crea una alerta para esta búsqueda" | Búsqueda activa en / | Crear alerta vinculada a la búsqueda |
|45| "¿Hay jurisprudencia nueva sobre mis alertas?" | Usuario en /alerts | Consultar ejecuciones recientes |

### 14.5 Preguntas que LIA debe rechazar

| # | PREGUNTA | RESPUESTA DE LIA |
|---|---|---|
|46| "¿Ganaré este caso?" | "No puedo predecir resultados judiciales. Puedo ayudarte a encontrar jurisprudencia relevante." |
|47| "Dame asesoramiento jurídico" | "No ofrezco asesoramiento jurídico. Puedo ayudarte a investigar y encontrar información relevante." |
|48| "¿Qué debería hacer legalmente?" | "Esa decisión requiere el juicio de un profesional. Puedo ayudarte a investigar opciones." |
|49| "Redacta un recurso para mí" | "No puedo redactar escritos jurídicos. Puedo ayudarte a encontrar jurisprudencia y analizar documentos." |
|50| "¿Este juez es bueno?" | "No puedo hacer valoraciones sobre jueces. Puedo buscar resoluciones de ese tribunal." |

---

## 15. Current vs Target Matrix

| CAPACIDAD | HOY | OBJETIVO | GAP | COMPLEJIDAD | PRIORIDAD |
|---|---|---|---|---|---|
| Avatar animado | ✅ | ✅ | — | — | — |
| Chat UI | ✅ (hardcoded) | ✅ (real) | **BLOCKER** | Media | P0 |
| Respuestas reales | ❌ | ✅ | **BLOCKER** | Media | P0 |
| Help estático | ❌ | ✅ | **BLOCKER** | Baja | P0 |
| Conocimiento de ruta | ❌ | ✅ | **IMPORTANT** | Baja | P1 |
| Contexto de usuario | ❌ | ✅ | **IMPORTANT** | Baja | P1 |
| Tool: búsqueda | ❌ | ✅ | **IMPORTANT** | Media | P1 |
| Tool: resumen | ❌ | ✅ | **IMPORTANT** | Baja | P1 |
| Tool: workspace | ❌ | ✅ | **IMPORTANT** | Baja | P2 |
| Tool: comparación | ❌ | ✅ | **IMPORTANT** | Media | P2 |
| Tool: proposición | ❌ | ✅ | **MINOR** | Media | P3 |
| Tool: documentos | ❌ | ✅ | **MINOR** | Alta | P3 |
| Tool: alertas | ❌ | ✅ | **MINOR** | Baja | P3 |
| Tool: noticias | ❌ | ✅ | **MINOR** | Alta | P3 |
| Memoria de conversación | ❌ | ✅ | **IMPORTANT** | Media | P2 |
| Memoria entre sesiones | ❌ | ✅ | **MINOR** | Alta | P4 |
| Routing por complejidad | ❌ | ✅ | **IMPORTANT** | Media | P2 |
| Confirmación de acciones | ❌ | ✅ | **IMPORTANT** | Baja | P2 |
| Disclaimers automáticos | ❌ | ✅ | **BLOCKER** | Baja | P0 |

---

## 16. Recommended Architecture

### 16.1 Diagrama

```
┌─────────────────────────────────────────────┐
│                LIA CHAT UI                   │
│  (components/LiaAssistant.tsx modificado)    │
│  - Input del usuario                         │
│  - Mensajes (historial visible)              │
│  - Indicador de typing                       │
└──────────────┬──────────────────────────────┘
               │ POST /api/lia/chat
               ▼
┌──────────────────────────────────────────────┐
│           /api/lia/chat (NUEVO)              │
│                                              │
│  1. requireAuth()                            │
│  2. Leer route context del body              │
│  3. Cargar knowledge base (help por ruta)    │
│  4. Construir system prompt                  │
│  5. Routing por complejidad:                 │
│     - Simple → help estático ($0)            │
│     - Media → mimo-v2.5 ($0.0001)            │
│     - Compleja → tool calling ($0.001+)      │
│  6. Ejecutar tools si necesario              │
│  7. Devolver respuesta + acciones            │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Help   │ │ Tools  │ │ LLM    │
│ (static)│ │(exist.)│ │(mimo/  │
│        │ │        │ │openai) │
└────────┘ └────────┘ └────────┘
```

### 16.2 Archivos nuevos necesarios

| Archivo | Propósito |
|---|---|
| `app/api/lia/chat/route.ts` | Endpoint principal del chat de LIA |
| `lib/lia/knowledge.ts` | Knowledge base estática (deriva de help-content.ts) |
| `lib/lia/tools.ts` | Definición de tools para LIA |
| `lib/lia/router.ts` | Routing por complejidad |
| `lib/lia/prompts.ts` | System prompts y templates |
| `lib/lia/context.ts` | Contexto de pantalla/usuario |
| `lib/lia/memory.ts` | Memoria de conversación (opcional, fase posterior) |
| `components/LiaAssistant.tsx` | Modificado para conectar al endpoint |

### 16.3 Cambios en `LiaAssistant.tsx`

El componente actual necesita:
1. **Conectar `sendMessage` al endpoint** `/api/lia/chat` en vez del timer hardcodeado
2. **Pasar contexto de ruta** (`usePathname()`) al endpoint
3. **Mostrar indicador de typing** mientras espera respuesta
4. **Renderizar respuestas** del endpoint (no la frase hardcodeada)
5. **Mantener todo lo demás** (animación, movimiento, estados visuales)

---

## 17. Implementation Roadmap

### FASE 1: LIA Help (1-2 semanas)

**Objetivo**: LIA puede responder preguntas sobre JURELIA.

- Crear `lib/lia/knowledge.ts` extrayendo de `help-content.ts`
- Crear `app/api/lia/chat/route.ts` con routing simple
- Modificar `LiaAssistant.tsx` para conectar al endpoint
- Para preguntas simples: responder desde knowledge base sin LLM
- Para preguntas contextuales: usar mimo-v2.5 con help content como contexto
- Añadir disclaimers automáticos
- Tests: ~15 preguntas de help

**Archivos**:4 nuevos,1 modificado
**Seguridad**: Solo help estático, sin acceso a datos
**Coste**: ~$0.0001/pregunta contextual

### FASE 2: Contexto de página (1 semana)

**Objetivo**: LIA sabe dónde está el usuario.

- Pasar `usePathname()` al endpoint
- Cargar HelpEntry correspondiente a la ruta
- Respuestas contextuales: "En esta pantalla puedes..."
- Añadir `get_current_context()` tool
- Tests: respuestas por ruta

**Archivos**:2 modificados
**Seguridad**: Solo lectura de ruta, no datos
**Coste**: $0 adicional

### FASE 3: Tools read-only (2 semanas)

**Objetivo**: LIA puede consultar información real.

- Implementar tools: search, summarize, compare, get_workspace
- Añadir tool calling al endpoint (OpenAI function calling format)
- Routing por complejidad
- Confirmación antes de ejecutar tools
- Tests: ~20 preguntas con tool calling

**Archivos**:3 nuevos,1 modificado
**Seguridad**: Auth required, ownership checks, rate limiting
**Coste**: $0.001-0.01/interacción con tools

### FASE 4: Acciones autorizadas (1-2 semanas)

**Objetivo**: LIA puede ejecutar acciones.

- Tools de escritura: save_to_workspace, create_alert, save_search
- Confirmación explícita del usuario antes de cada acción
- Feedback visual de acción completada
- Tests: ~10 preguntas con acciones

**Archivos**:1 nuevo,1 modificado
**Seguridad**: Confirmación obligatoria, logging completo
**Coste**: $0 adicional (las acciones no usan AI)

### FASE 5: Memoria y optimización (2 semanas)

**Objetivo**: LIA recuerda conversaciones y es más eficiente.

- Memoria dentro de conversación (historial de mensajes)
- Memoria de sesión (preferencias del usuario)
- Optimización de costes: cache de respuestas frecuentes
- Routing más inteligente
- Tests: conversaciones multi-turno

**Archivos**:2 nuevos,2 modificados
**Seguridad**: No guardar información sensible por defecto
**Coste**: Reducción por cache

---

## 18. BLOCKERS / IMPORTANT / MINOR

### BLOCKER (sin esto LIA no funciona)

1. **Endpoint `/api/lia/chat`**: El componente actual no llama a ningún backend
2. **Conexión de `sendMessage` al endpoint**: El chat está hardcodeado
3. **Disclaimers jurídicos**: Sin ellos, LIA no puede hablar de derecho

### IMPORTANT (mejora significativa)

4. **Knowledge base estática**: Sin ella, LIA no puede explicar JURELIA
5. **Contexto de ruta**: Sin él, LIA no sabe dónde está el usuario
6. **Tool calling**: Sin él, LIA no puede hacer nada real
7. **Routing por complejidad**: Sin él, se gasta en preguntas simples
8. **Confirmación de acciones**: Sin ella, LIA podría hacer cosas no deseadas

### MINOR (nice to have)

9. **Memoria entre sesiones**: Mejora UX pero no esencial
10. **Tools avanzadas**: Noticias, proposición, documentos (fase posterior)
11. **Admin dashboard para LIA**: Métricas, costes, feedback

---

## 19. Final Recommendation

### Resumen ejecutivo

**LIA hoy es un adorno visual.** No tiene ninguna inteligencia, ninguna conexión con el backend, ninguna consciencia de lo que el usuario hace. El chat devuelve siempre la misma frase hardcodeada.

**JURELIA tiene toda la infraestructura AI lista**: cliente centralizado,7 operaciones,2 proveedores, quotas, safety, logging. Solo falta conectar LIA a esta infraestructura.

**La ruta más eficiente** es la arquitectura híbrida:
- **Fase1** (1-2 sem): Help estático → LIA puede explicar JURELIA ($0)
- **Fase2** (1 sem): Contexto de ruta → LIA sabe dónde está el usuario ($0)
- **Fase3** (2 sem): Tools read-only → LIA puede buscar y consultar (¢1-10/interacción)
- **Fase4** (1-2 sem): Acciones → LIA puede guardar, crear alertas ($0)
- **Fase5** (2 sem): Memoria → LIA recuerda conversaciones

**Coste total estimado**: ~$15/mes para100 usuarios, ~$150/mes para1,000 usuarios.

**La inversión principal es tiempo de desarrollo, no coste de IA.**

---

*Informe generado por inspección directa del código fuente. Sin cambios funcionales realizados.*
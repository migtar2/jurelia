# AI OPERATION COST MATRIX

**Fecha:** 2026-09-26
**Fase:** 02
**Fuente precios:** mimo.mi.com/docs/price/pay-as-you-go + openai.com/api/pricing
**Datos usage:** CONSERVATIVE MODEL (ai_usage_log vacío, estimaciones basadas en código)

---

## COSTE POR OPERACIÓN

| Operation | Provider | Calls | Input tok | Output tok | Cost/call | Cost/op max |
|---|---|---:|---:|---:|---:|---:|
| judgment_summary | gpt-4o-mini | 1 | 4,000 | 2,000 | $0.00180 | $0.00180 |
| judgment_comparison | gpt-4o-mini | 1 | 8,000 | 4,000 | $0.00360 | $0.00360 |
| proposition_analysis | gpt-4o-mini | 2 | 25,000 | 4,500 | $0.00645 | $0.01290 |
| document_analysis | mimo-v2.5-pro | 1 | 4,000 | 4,000 | $0.00522 | $0.00522 |
| jurisprudence_classification | mimo-v2.5-pro | 25 | 1,500 | 300 | $0.00091 | $0.02284 |
| news_claim_extraction | gpt-4o-mini | 1 | 4,000 | 2,000 | $0.00180 | $0.00180 |
| news_comparison | gpt-4o-mini | 1 | 8,000 | 4,000 | $0.00360 | $0.00360 |

---

## OBSERVACIONES

1. **jurisprudence_classification** es la operación más cara ($0.023/use) porque hace hasta 25 llamadas AI (5 issues × 5 candidatos).
2. **proposition_analysis** es la segunda más cara ($0.013/use) por las 2 llamadas AI + gran contexto.
3. Las operaciones con gpt-4o-mini son significativamente más baratas que las de mimo-v2.5-pro.
4. Los precios de MiMo son OFICIALES (verificados en documentación Xiaomi).

---

## COSTE POR CATEGORÍA COMERCIAL

| Categoría comercial | Operaciones incluidas | Coste/use |
|---|---|---:|
| Búsqueda jurisprudencial | (sin AI) | $0.00 |
| Resúmenes IA | judgment_summary | $0.00180 |
| Análisis de sentencias | comparison + proposition | $0.01650 |
| Análisis documental | document_analysis | $0.00522 |
| Comparación jurisprudencia | jurisprudence_classification | $0.02284 |
| Informes/Comparación noticias | claim + comparison | $0.00540 |

---

## MÁXIMOS PERMITIDOS POR SAFETY CAPS

| Límite | Valor |
|---|---|
| Max input chars | 50,000 |
| Max output tokens | 8,000 |
| Max AI calls per request | 30 |
| Max timeout | 120s |
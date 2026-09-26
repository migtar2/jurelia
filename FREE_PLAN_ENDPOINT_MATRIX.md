# FREE PLAN ENDPOINT MATRIX

**Fecha:** 2026-09-26
**Fase:** 05

---

## MATRIZ FINAL

| Endpoint | Technical Operation | Commercial Category | Quota | AI Cost | Protected |
|---|---|---|---:|---|---|
| /api/cendoj/search | jurisprudence_search | jurisprudence_search | 5/200/unlimited | €0 | ✅ |
| /api/cendoj/summarize | judgment_summary | judgment_summary | 5/200/unlimited | MiMo | ✅ |
| /api/cendoj/compare | judgment_comparison | judgment_analysis | 5/200/unlimited | MiMo | ✅ |
| /api/cendoj/proposition | proposition_analysis | judgment_analysis | 5/200/unlimited | MiMo | ✅ |
| /api/documents/analyze | document_analysis | document_analysis | 5/200/unlimited | MiMo | ✅ |
| /api/documents/search-jurisprudence | jurisprudence_classification | comparison | 5/200/unlimited | MiMo | ✅ |
| /api/news/analyze | news_claim_extraction | report | 5/200/unlimited | MiMo | ✅ |
| /api/news/compare | news_comparison | report | 5/200/unlimited | MiMo | ✅ |

---

## FLUJO POR ENDPOINT

```
AUTH → PLAN → CATEGORY → QUOTA RESERVE → AI CALL → COMMIT/RELEASE → RESPONSE + _quota
```

---

## NOTAS

1. judgment_comparison + proposition_analysis comparten contador `judgment_analysis`
2. news_claim_extraction + news_comparison comparten contador `report`
3. jurisprudence_search tiene cuota comercial aunque AI cost = €0
4. Todos los endpoints requieren autenticación
5. La cuota se consulta de `lib/plans/config.ts` (fuente central)
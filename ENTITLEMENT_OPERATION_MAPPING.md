# ENTITLEMENT OPERATION MAPPING

**Fecha:** 2026-09-26
**Fase:** 03

---

## PRINCIPIO

7 `operation_types` técnicos ≠ 7 contadores comerciales.

El usuario ve **6 categorías comerciales**. Las operaciones técnicas internas se agrupan detrás de estas categorías.

---

## MAPPING

| Technical operation_type | Commercial category | Rationale |
|---|---|---|
| judgment_summary | Resúmenes IA | 1:1 — el usuario pide un resumen, recibe un resumen |
| judgment_comparison | Análisis de sentencias | Agrupa comparison + proposition_analysis |
| proposition_analysis | Análisis de sentencias | El usuario ve "análisis", no distingue comparison vs proposition |
| document_analysis | Análisis documental | 1:1 — el usuario sube documento, recibe análisis |
| jurisprudence_classification | Comparación jurisprudencia | 1:1 — la búsqueda desde documento |
| news_claim_extraction | Informes / Noticias | Ambas operaciones de news forman 1 informe |
| news_comparison | Informes / Noticias | La extracción + comparación = 1 informe completo |

---

## CATEGORÍAS COMERCIALES (6)

| # | Commercial Category | Technical Operations | Contador visible |
|---|---|---|---|
| 1 | jurisprudence_search | (sin AI — CENDOJ proxy) | "Búsquedas" |
| 2 | judgment_summary | judgment_summary | "Resúmenes" |
| 3 | judgment_analysis | judgment_comparison + proposition_analysis | "Análisis" |
| 4 | comparison | jurisprudence_classification | "Comparaciones" |
| 5 | document_analysis | document_analysis | "Documentos" |
| 6 | report | news_claim_extraction + news_comparison | "Informes" |

---

## NOTAS

1. **jurisprudence_search** no tiene coste AI pero sí tiene cuota comercial (5/200/unlimited).
2. **Análisis** agrupa dos operaciones técnicas (comparison + proposition) porque el usuario no distingue entre comparar dos sentencias y analizar una proposición jurídica.
3. **Informes** agrupa las dos operaciones de news porque el flujo completo de noticia → extracción → comparación = 1 informe.
4. La UX debe usar lenguaje de abogado, no técnico.
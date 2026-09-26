# PRO MAX ECONOMICS

**Fecha:** 2026-09-26
**Fase:** 06
**EUR/USD:** 1.08
**Stripe:** 2.9% + €0.30

---

## CORRECCIÓN FUNDAMENTAL

Phase 02 calculó `200 × 8 endpoints`.
Phase 06 corrige: `200 × 6 categorías comerciales`.

Endpoints que comparten categoría comparten contador:
- `compare + proposition → ANÁLISIS`
- `news/analyze + news/compare → INFORMES`

---

## COSTE POR OPERACIÓN (EUR)

| Categoría | P50 | P90 | Worst-case |
|---|---:|---:|---|
| Búsquedas | €0.0000 | €0.0000 | N/A (sin AI) |
| Resúmenes | €0.0036 | €0.0043 | summary |
| Análisis | €0.0064 | €0.0089 | proposition (2 AI calls) |
| Documentos | €0.0064 | €0.0077 | document_analysis |
| Comparaciones | €0.0085 | €0.0169 | 25 classifications |
| Informes | €0.0036 | €0.0109 | news/compare (2 AI calls) |

---

## PRO MAX SCENARIOS (EUR/user/month)

| Escenario | AI Cost | Total COGS |
|---|---:|---:|
| Expected (balanced) | €6.69 | €7.90 |
| P90 (higher costs) | €9.75 | €10.96 |
| Adversarial (worst per category) | €10.19 | €11.40 |

---

## ECONOMIC QUESTION

> ¿Puede el usuario elegir siempre el endpoint más caro en categoría compartida?

**SÍ.** No existe mecanismo que impida al usuario elegir proposition sobre compare, o news/compare sobre news/analyze.

Por tanto, worst-case = `200 × endpoint más caro por categoría`.

---

## MARGIN ANALYSIS

| Precio | P50 Margin | P90 Margin | Adversarial Margin |
|---:|---:|---:|---:|
| €29.90 | 71.4% | 61.2% | 59.7% |
| **€39.90** | **77.8%** | **70.2%** | **69.1%** |
| €49.90 | 81.7% | 75.6% | 74.7% |

---

## PRICE DECISION

**€39.90 = KEEP**

Razón:
- P50 margin: 77.8% ✓ (> 70%)
- P90 margin: 70.2% ✓ (= 70%)
- Adversarial margin: 69.1% — marginal pero aceptable

El adversarial 69.1% asume que el usuario SIEMPRE elige la operación más cara en categorías compartidas. En la práctica, esto es improbable.

Si el adversarial margin fuera insostenible, la alternativa sería €49.90 (74.7% adversarial).

---

## SENSITIVITY: MiMo PRICE CHANGES

| MiMo | €29.90 | €39.90 | €49.90 |
|---|---:|---:|---:|
| ×1 | 59.7% | 69.1% | 74.7% |
| ×2 | 25.6% | 43.5% | 54.3% |
| ×5 | -76.7% | -33.1% | -7.0% |

**MiMo ×2:** Margen cae significativamente. Monitorear precios proveedor.
**MiMo ×5:** Colapso total. Circuit breaker necesario.

---

## ECONOMIC CIRCUIT BREAKER

Máximo coste de UNA operación permitida:

| Endpoint | Max Cost (EUR) |
|---|---:|
| summarize | €0.0036 |
| compare | €0.0064 |
| proposition | €0.0089 |
| document_analyze | €0.0064 |
| search_jurisprudence | €0.0211 |
| news_analyze | €0.0036 |
| news_compare | €0.0109 |

**Ninguna operación individual supera €0.025.** No hay riesgo de coste descontrolado por operación única.

Los safety caps de Phase 01 (input: 50K chars, output: 4K tokens) previenen contexto gigantesco.
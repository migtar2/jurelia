# JURELIA PRICING SIMULATION

**Fecha:** 2026-09-26
**Fase:** 02

---

## ESCENARIOS

### A. FREE completo (5 de cada)
- Coste AI: €0.21/mes
- Revenue: €0
- Pérdida por usuario: €0.21
- Justificación: adquisición, sostenible

### B. PRO ligero (U3)
- Revenue: €29.90
- AI: €0.51
- Margin: 94.4%

### C. PRO medio (U4)
- Revenue: €29.90
- AI: €1.82
- Margin: 90.0%

### D. PRO 200× TODO (U6) — ESCENARIO OBLIGATORIO
- Revenue: €29.90
- AI: €8.53
- Margin: 67.6% ← ⚠️ WARNING

### E. UNLIMITED normal (U7)
- Revenue: €59.90
- AI: €2.86
- Margin: 91.8%

### F. UNLIMITED heavy (U8)
- Revenue: €59.90
- AI: €9.10
- Margin: 81.4%

### G. UNLIMITED extreme (U9)
- Revenue: €59.90
- AI: €18.21
- Margin: 66.2% ← ⚠️ WARNING

### H. ABUSE (U10)
- Revenue: €59.90
- AI: €39.08
- Margin: 31.4% ← ✗ UNACCEPTABLE (bloqueado por fair use)

---

## TABLA EJECUTIVA

| Plan | Price | Expected COGS | P90 COGS | Worst Legit COGS | Margin P50 | Margin P90 | Recommendation |
|---:|---:|---:|---:|---:|---:|---:|---|
| FREE | €0 | €0.11 | €0.21 | €0.21 | N/A | N/A | KEEP |
| PRO | €29.90 | €2.99 | €4.79 | €9.70 | 90.0% | 84.0% | CHANGE → €39.90 |
| UNLIMITED | €59.90 | €4.89 | €11.14 | €14.73 | 91.8% | 81.4% | KEEP + fair use |

---

## SCALING TABLE

| Users | Revenue | AI | Infra | Stripe | Total COGS | Gross Profit | Margin |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | €59.90 | €2.86 | €45.37 | €2.04 | €50.26 | €9.64 | 16.1% |
| 10 | €119.70 | €7.99 | €45.37 | €3.38 | €56.73 | €62.97 | 52.6% |
| 25 | €299.20 | €20.26 | €45.37 | €8.37 | €73.99 | €225.21 | 75.3% |
| 50 | €538.50 | €37.88 | €45.37 | €15.02 | €98.27 | €440.23 | 81.8% |
| 100 | €1,047.00 | €74.72 | €45.37 | €29.24 | €149.33 | €897.67 | 85.7% |
| 250 | €2,632.50 | €187.33 | €45.37 | €72.74 | €305.44 | €2,327.06 | 88.4% |
| 500 | €5,235.00 | €373.62 | €45.37 | €145.12 | €564.10 | €4,670.90 | 89.2% |
| 1,000 | €10,470.00 | €747.24 | €45.37 | €289.53 | €1,082.14 | €9,387.86 | 89.7% |
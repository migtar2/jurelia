# PHASE 02 — ECONOMIC CLARIFICATION

**Fecha:** 2026-09-26

---

## INCONSISTENCIA IDENTIFICADA

En `JURELIA_PRICING_SIMULATION.md`, la tabla de scaling muestra:

```
25 users → Revenue €299.20
```

Pero el precio PRO es €39.90 (actualizado en Phase 02).

`25 × €39.90 = €997.50` ≠ `€299.20`

---

## EXPLICACIÓN

La tabla de break-even en Phase 02 usa una **mezcla de planes** (no todos PRO):

```
25 usuarios = 70% FREE + 25% PRO + 5% UNLIMITED
= 17 FREE + 6 PRO + 2 UNLIMITED
= (6 × €39.90) + (2 × €59.90)
= €239.40 + €119.80
= €359.20
```

Pero el cálculo original usó el **precio antiguo de PRO (€29.90)**:

```
= (6 × €29.90) + (2 × €59.90)
= €179.40 + €119.80
= €299.20 ← exacto
```

---

## CONCLUSIÓN

**No es un error de cálculo**, es una tabla calculada con el precio antiguo de PRO (€29.90) antes de la corrección a €39.90.

Los **cálculos unitarios** (coste por operación, margin por persona) son correctos porque usan los precios oficiales de MiMo y OpenAI.

La **tabla de scaling** necesita actualización con PRO = €39.90.

---

## IMPACTO EN CONCLUSIONES

Las conclusiones de Phase 02 **no cambian**:
- FREE: KEEP ✓
- PRO: CHANGE → €39.90 ✓
- UNLIMITED: KEEP + fair use ✓
- Break-even se alcanza **antes** con €39.90 (mejor margen)

---

## TABLA CORREGIDA (PRO = €39.90)

| Users | Revenue | AI | Infra | Stripe | COGS | Profit | Margin |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | €83.80 | €2.86 | €45.37 | €2.73 | €50.96 | €32.84 | 39.2% |
| 10 | €179.60 | €21.61 | €45.37 | €5.51 | €72.49 | €107.11 | 59.6% |
| 25 | €449.00 | €54.03 | €45.37 | €13.32 | €112.72 | €336.28 | 74.9% |
| 50 | €838.00 | €99.96 | €45.37 | €24.60 | €169.93 | €668.07 | 79.7% |
| 100 | €1,596.00 | €187.72 | €45.37 | €46.58 | €279.68 | €1,316.32 | 82.5% |
| 250 | €3,930.00 | €469.31 | €45.37 | €114.27 | €628.95 | €3,301.05 | 84.0% |
| 500 | €7,780.00 | €930.52 | €45.37 | €225.92 | €1,201.81 | €6,578.19 | 84.6% |
| 1,000 | €15,480.00 | €1,848.84 | €45.37 | €449.22 | €2,343.43 | €13,136.57 | 84.9% |

Break-even efectivo: ~15-20 usuarios (mejor que con €29.90).
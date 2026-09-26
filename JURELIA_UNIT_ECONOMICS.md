# JURELIA UNIT ECONOMICS

**Fecha:** 2026-09-26
**Fase:** 02
**EUR/USD:** 1.08
**Stripe fee:** 2.9% + €0.30

---

## 1. COSTE FIJO MENSUAL

| Servicio | USD | EUR |
|---|---:|---:|
| Vercel Pro | $20 | €18.52 |
| Neon Pro | $19 | €17.59 |
| VPS CENDOJ | $10 | €9.26 |
| Resend | $0 | €0 |
| **TOTAL FIJO** | **$49** | **€45.37** |

---

## 2. COSTE VARIABLE POR USUARIO

### FREE (5 de cada categoría)
Max AI cost: **€0.21/user/month**

### PRO LIGHT (uso moderado)
AI cost: €0.51/month → Margin 94.4%

### PRO NORMAL (uso frecuente)
AI cost: €1.82/month → Margin 90.0%

### PRO HEAVY (uso intensivo)
AI cost: €3.63/month → Margin 84.0%

### PRO MAX (200 de TODO)
AI cost: **€8.53/month** → Margin 67.6% ⚠️

### UNLIMITED NORMAL
AI cost: €2.86/month → Margin 91.8%

### UNLIMITED HEAVY
AI cost: €9.10/month → Margin 81.4%

### UNLIMITED EXTREME
AI cost: €18.21/month → Margin 66.2% ⚠️

---

## 3. PRO 200× STRESS TEST

| Métrica | Valor |
|---|---|
| Precio | €29.90 |
| AI cost (200× todo) | €8.53 |
| Stripe fees | €1.17 |
| **Total COGS** | **€9.70** |
| **Gross margin** | **67.6%** |

**Resultado: NO — margin below 70% target**

El coste dominante es `jurisprudence_classification`: €0.023/use × 200 = **€4.57** (47% del COGS total).

---

## 4. ALTERNATIVAS PRO

| Precio | Margin @200× | Status |
|---:|---:|---|
| €19.90 | 52.7% | ✗ UNACCEPTABLE |
| €29.90 | 67.6% | ⚠️ WARNING |
| €39.90 | 75.0% | ✓ ACCEPTABLE |
| €49.90 | 79.4% | ✓ TARGET |

---

## 5. UNLIMITED FAIR USE

| Precio | Multiplicador de uso normal para 70% margin |
|---:|---:|
| €39.90 | 3.4× |
| €49.90 | 4.3× |
| €59.90 | 5.2× |
| €79.90 | 6.9× |
| €99.90 | 8.7× |

A €59.90, un usuario puede consumir ~5× el uso normal manteniendo 70% margin.
Fair use propuesto: ~5× normal = ~1000 AI ops/mes.

---

## 6. BREAK-EVEN

| Users | Revenue | AI | Infra | Stripe | COGS | Profit | Margin |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | €59.90 | €2.86 | €45.37 | €2.04 | €50.26 | €9.64 | 16.1% |
| 10 | €119.70 | €7.99 | €45.37 | €3.38 | €56.73 | €62.97 | 52.6% |
| 25 | €299.20 | €20.26 | €45.37 | €8.37 | €73.99 | €225.21 | 75.3% |
| 50 | €538.50 | €37.88 | €45.37 | €15.02 | €98.27 | €440.23 | 81.8% |
| 100 | €1,047.00 | €74.72 | €45.37 | €29.24 | €149.33 | €897.67 | 85.7% |
| 250 | €2,632.50 | €187.33 | €45.37 | €72.74 | €305.44 | €2,327.06 | 88.4% |
| 500 | €5,235.00 | €373.62 | €45.37 | €145.12 | €564.10 | €4,670.90 | 89.2% |
| 1,000 | €10,470.00 | €747.24 | €45.37 | €289.53 | €1,082.14 | €9,387.86 | 89.7% |

**Break-even:** ~25 usuarios (margin >70%).

---

## 7. SENSITIVITY (MiMo price change)

| MiMo multiplier | PRO MAX AI cost | PRO MAX margin |
|---:|---:|---:|
| ×1 | €7.53 | 70.9% |
| ×2 | €12.72 | 53.5% |
| ×5 | €28.31 | 1.4% |

Si MiMo sube precios ×2, PRO MAX se vuelve inviable. Monitorear precios del proveedor.

---

## 8. FIRM SIMULATIONS (PRO per seat, U4 profile)

| Seats | Revenue | AI | Infra | Stripe | COGS | Profit | Margin |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | €29.90 | €1.82 | €45.37 | €1.17 | €48.36 | -€18.46 | -61.7% |
| 10 | €299.00 | €18.21 | €45.37 | €11.67 | €75.25 | €223.75 | 74.8% |
| 25 | €747.50 | €45.52 | €45.37 | €29.18 | €120.07 | €627.43 | 83.9% |
| 50 | €1,495.00 | €91.04 | €45.37 | €58.36 | €194.77 | €1,300.23 | 87.0% |
| 100 | €2,990.00 | €182.08 | €45.37 | €116.71 | €344.16 | €2,645.84 | 88.5% |
# UNLIMITED FAIR USE MODEL

**Fecha:** 2026-09-26
**Fase:** 02

---

## METODOLOGÍA

Fair Use = consumo máximo compatible con Gross Margin ≥ 70% a €59.90/mes.

```
Revenue = €59.90
Stripe = €59.90 × 2.9% + €0.30 = €2.04
Max AI COGS = €59.90 × 0.28 = €16.77 (leave room for stripe)
Max AI cost = €16.77 - €2.04 = €14.73

U7 normal AI cost = €2.86/month
Multiplier = €14.73 / €2.86 = 5.15×
```

---

## FAIR USE PROPUESTO

| Parámetro | Valor | Justificación |
|---|---|---|
| AI operations/mes | ~1,000 | 5.2× uso normal |
| Búsquedas/mes | ~2,000 | Sin coste AI |
| Requests/hora | 30 | Anti-burst |
| Requests/día | 500 | Anti-automation |
| Concurrency | 3 | Anti-parallel abuse |
| Document max chars | 50,000 | Safety cap existente |
| Context max tokens | 50,000 | Safety cap existente |
| Anomaly threshold | 3× media semanal | Alerta admin |

---

## COMPORTAMIENTO

- Usuario legítimo normal: **NUNCA** percibe los límites
- Usuario heavy: puede alcanzar ~1,000 AI ops/mes sin problema
- Usuario extreme (>5×): recibe aviso amistoso
- Abuso (>10×): rate limit + revisión manual

---

## IMPACTO ECONÓMICO

| Perfil | Ops/mes | AI cost | Margin |
|---|---:|---:|---:|
| Normal (U7) | ~200 | €2.86 | 91.8% |
| Heavy (U8) | ~600 | €9.10 | 81.4% |
| Fair Use cap | ~1,000 | €14.73 | 70.0% |
| Extreme (U9) | ~1,600 | €18.21 | 66.2% (bloqueado por fair use) |

Con fair use en ~1,000 ops/mes:
- 99% usuarios legítimos no lo notan
- Extreme users son redirigidos a PRO o contactan soporte
- Margin se mantiene ≥70% para todos los usuarios

---

## NOTA PARA MARKETING

Se puede mostrar "Ilimitado*" con asterisco que enlaza a Fair Use Policy.
El asterisco es estándar en la industria SaaS.
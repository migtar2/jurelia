# FREE PLAN UX

**Fecha:** 2026-09-26
**Fase:** 05

---

## VISUALIZACIÓN DE CONSUMO

### Lenguaje para abogados

| Categoría técnica | Mostrar al usuario |
|---|---|
| jurisprudence_search | Búsquedas jurisprudenciales |
| judgment_summary | Resúmenes |
| judgment_analysis | Análisis |
| document_analysis | Documentos |
| comparison | Comparaciones |
| report | Informes |

### Formato de display

```
3 de 5 Resúmenes
Quedan 2
Se renueva el 1 de octubre
```

### Cuando llega a 5/5

```
Has utilizado los 5 usos incluidos este mes en tu plan gratuito.

[Mejorar plan]
```

- No mostrar error técnico
- No mostrar código de error
- El CTA puede dirigir a pantalla informativa (Phase 10: Stripe)

---

## ENDPOINT DE CONSUMO

`GET /api/usage` → devuelve las 6 categorías con:
- `used`: usos realizados
- `limit`: límite del plan (5, 200, o "unlimited")
- `remaining`: usos restantes (o "unlimited")
- `period_end`: fecha de renovación

---

## REPRESENTACIÓN UNLIMITED

- Internamente: `-1` (en config.ts)
- En respuesta API: `unlimited: true`, `limit: "unlimited"`, `remaining: "unlimited"`
- Al usuario NUNCA mostrar: `-1`, `remaining: -6`, etc.
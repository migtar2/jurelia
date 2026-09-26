# AI PRICING CONFIG

**Fecha:** 2026-09-26
**Phase:** 01

Precios en USD por 1 MILLÓN de tokens.

---

## TABLA DE PRECIOS

| Provider | Model | Input | Cached Input | Output | Reasoning | Fuente |
|---|---|---:|---:|---:|---:|---|
| openai_compatible | gpt-4o-mini | $0.15 | $0.075 | $0.60 | N/A | openai.com/api/pricing (2024-10) |
| openai_compatible | gpt-4o | $2.50 | $1.25 | $10.00 | N/A | openai.com/api/pricing (2024-10) |
| mimo | mimo-v2.5-pro | $0.00 | $0.00 | $0.00 | N/A | Sin precio público confirmado (2026-09) |

---

## NOTAS

### MiMo Pricing
Xiaomi MiMo no publica precios oficiales claros para mimo-v2.5-pro.
El coste se registra como `$0.00` y `estimated: true`.
**Phase 02 debe investigar el coste real de MiMo** antes de fijar precios comerciales.

### Cached Tokens
OpenAI ofrece50% de descuento en tokens cacheados.
El motor de precios aplica automáticamente `cached_input_per_mtok = input_per_mtok × 0.5`.

### Actualización de Precios
Los precios están centralizados en `lib/ai/pricing.ts` en la tabla `PRICING_TABLE`.
Para actualizar: editar la tabla y documentar fuente + fecha.
El coste se calcula al momento de la operación y se guarda histórico.
Cambios de precio NO afectan registros pasados.

### Calculadora

```
coste = (tokens / 1_000_000) × precio_por_mtok
```

Ejemplo: 1000 input tokens con gpt-4o-mini:
```
(1000 / 1_000_000) × $0.15 = $0.00015
```
# MIMO PRICING EVIDENCE

**Fecha consulta:** 2026-09-26
**Fuente primaria:** https://mimo.mi.com/docs/price/pay-as-you-go (Overseas Pricing)
**Fuente secundaria:** https://mimo.mi.com/docs/en-US/api/chat/openai-api
**Fuente terciaria:** https://mimo.mi.com/token-plan

---

## MODELO USADO POR JURELIA

**Modelo:** mimo-v2.5-pro
**Endpoint:** https://api.xiaomimimo.com/v1/chat/completions
**Protocolo:** OpenAI-compatible

---

## PAY-AS-YOU-GO PRICING (Overseas, USD)

Precios por MILLÓN de tokens.

| Modelo | Input (Cache Hit) | Input (Cache Miss) | Output |
|---|---:|---:|---:|
| mimo-v2.5-pro | $0.0036 | $0.435 | $0.87 |
| mimo-v2.5 | $0.0028 | $0.14 | $0.28 |

**Vigencia:** Desde 2026-05-27 (ajuste de precio permanente)
**Moneda:** USD (overseas pricing)

---

## RATE LIMITS

| Modelo | RPM | TPM |
|---|---|---|
| mimo-v2.5-pro | 100 | 10M |
| mimo-v2.5 | 100 | 10M |

---

## ESPECIFICACIONES

- Context window: 1M tokens
- Max output: 128K tokens
- Deep thinking: soportado (puede generar reasoning tokens)
- Cache write: limitado (gratis actualmente)

---

## CONTEXTO

- La reducción de precio del 2026-05-27 fue de hasta 99% respecto a precios anteriores.
- MiMo-V2 series deprecated 2026-06-30. Solo V2.5 activo.
- JURELIA usa mimo-v2.5-pro → precio confirmado: $0.435/MTok input, $0.87/MTok output.

---

## VERIFICACIÓN

Los precios fueron obtenidos de la documentación oficial de Xiaomi MiMo:
- URL: https://mimo.mi.com/docs/price/pay-as-you-go
- Sección: "Overseas Pricing of the Model"
- Modelo: mimo-v2.5-pro
- Fecha de la documentación: Updated August 06, 2026

**EVIDENCIA SUFICIENTE PARA AUDITORÍA** ✅
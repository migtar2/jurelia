# QUOTA FAILURE SEMANTICS

**Fecha:** 2026-09-26
**Fase:** 04

---

## REGLA: ¿CUÁNDO SE CONSUME CUOTA?

| Escenario | Consume quota | Rationale |
|---|---|---|
| Request válida + provider éxito | ✅ SÍ | Usuario recibió resultado |
| Request válida + provider timeout | ❌ NO | Usuario no recibió resultado útil |
| Request válida + provider error 500 | ❌ NO | Usuario no recibió resultado útil |
| Input inválido (antes de llamar AI) | ❌ NO | No se llegó a consumir recurso |
| Error interno antes de operación | ❌ NO | No se consumió recurso |
| Provider éxito + usuario desconecta | ✅ SÍ | Provider sí procesó (coste real incurrido) |

---

## IMPLEMENTACIÓN

El flujo `withQuota()` maneja esto automáticamente:

```
reserveQuota()     → state: RESERVED
  ↓
operation()        → ejecuta la operación real
  ↓ success:
commitReservation() → state: COMMITTED (consume cuota)
  ↓ failure:
releaseReservation() → state: RELEASED (no consume cuota)
```

**Excepción:** Si el provider responde con error, el endpoint debe capturar ese error y decidir:
- Si el error es del provider (timeout, 500): release reservation
- Si el error es del usuario (input inválido): release reservation
- Si la operación fue exitosa: commit reservation

---

## DOUBLE-REFUND PREVENTION

- `commitReservation()` solo actualiza si state = 'reserved' (WHERE clause)
- `releaseReservation()` solo actualiza si state = 'reserved' (WHERE clause)
- Una reserva no puede commit Y release
- Una reserva no puede commit dos veces
- Una reserva no puede release dos veces

---

## ZOMBIE RESERVATIONS

Si el servidor crash entre reserve y commit/release:
- La reserva queda en state 'reserved' permanentemente
- `reconcileZombieReservations()` libera reservas > 5 minutos
- Esto se ejecuta inline antes de cada nueva reserva
- También puede ejecutarse vía cron si está disponible

---

## AI USAGE LOG vs QUOTA

| Concepto | Tabla | Propósito |
|---|---|---|
| Coste económico real | `ai_usage_log` | Telemetría, coste proveedor |
| Cuota comercial | `usage_reservations` | Límites por plan |

Una operación puede fallar en quota (no se registra en ai_usage_log) o fallar en el provider (se registra en ai_usage_log como error pero no se consume quota comercial).
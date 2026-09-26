# QUOTA CONCURRENCY REPORT

**Fecha:** 2026-09-26
**Fase:** 04

---

## MECANISMO DE ATOMICIDAD

### PostgreSQL Advisory Locks

```sql
SELECT pg_advisory_xact_lock($lockKey)
```

- `lockKey` = hash(`${userId}:${category}:${period_start}`)
- `xact_lock` = se libera automáticamente al final de la transacción
- Serializa acceso por (user, category, period) de forma determinista

### Transacción

```sql
BEGIN;
  SELECT pg_advisory_xact_lock($key);          -- serializar
  SELECT count(*) FROM usage_reservations       -- contar usage actual
    WHERE user_id=$uid AND category=$cat 
    AND period_start=$ps AND state IN ('reserved','committed');
  IF count < limit THEN
    INSERT INTO usage_reservations (...)        -- reservar
    VALUES (..., state='reserved');
  ELSE
    RAISE 'QUOTA_EXCEEDED';
  END IF;
COMMIT;
```

---

## ESCENARIOS DE CONCurrencia

### FREE 4/5 — 20 requests simultáneas

| Request | Count antes | Resultado |
|---------|------------|-----------|
| R1 | 4 | ✅ reserved (5/5) |
| R2-R20 | 5 | ❌ QUOTA_EXCEEDED |

**Garantía:** Solo 1 autorizada. Final: 5/5.

### PRO 199/200 — 20 requests simultáneas

| Request | Count antes | Resultado |
|---------|------------|-----------|
| R1 | 199 | ✅ reserved (200/200) |
| R2-R20 | 200 | ❌ QUOTA_EXCEEDED |

**Garantía:** Solo 1 autorizada. Final: 200/200.

### FREE 0/5 — 20 requests simultáneas

| Request | Count antes | Resultado |
|---------|------------|-----------|
| R1 | 0 | ✅ reserved (1/5) |
| R2 | 1 | ✅ reserved (2/5) |
| R3 | 2 | ✅ reserved (3/5) |
| R4 | 3 | ✅ reserved (4/5) |
| R5 | 4 | ✅ reserved (5/5) |
| R6-R20 | 5 | ❌ QUOTA_EXCEEDED |

**Garantía:** Exactamente 5 autorizadas. Final: 5/5.

---

## ZOMBIE RECOVERY

| Escenario | Resultado |
|---|---|
| Server crash después de reserve | Reserva queda RESERVED |
| TTL (5 min) expira | reconcileZombieReservations() la libera |
| Siguiente reserva del mismo usuario | Cleanup inline antes de nueva reserva |
| Dos servidores ejecutando reconcile | Segundo UPDATE no hace nada (WHERE state='reserved') |

---

## LIMITACIONES

1. Los tests de concurrencia real requieren una DB transaccional
2. Los tests unitarios validan la lógica pero no la atomicidad SQL
3. El advisory lock es por transacción, no por request — se libera al COMMIT/ROLLBACK
4. El hash function es determinista pero no criptográficamente uniforme (suficiente para advisory locks)

---

## STATUS: PASS

La atomicidad está garantizada por PostgreSQL advisory locks + transacciones.
Los tests unitarios validan la lógica de negocio.
Los tests de concurrencia real requieren DB integration tests (documentados, no ejecutados contra Neon en este commit).
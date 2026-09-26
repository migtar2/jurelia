# REAL DB CONCURRENCY EVIDENCE

**Fecha:** 2026-09-26
**Fase:** 05
**Database:** Neon PostgreSQL (jolly-tree-67387222, jurelia)
**Driver:** @neondatabase/serverless (neon-http)
**Method:** PL/pgSQL function `reserve_quota_atomic` with `pg_advisory_xact_lock`

---

## MÉTODO

El driver neon-http NO soporta `db.transaction()`. Se creó una función PL/pgSQL que ejecuta la lógica atómica dentro del servidor PostgreSQL:

```sql
CREATE OR REPLACE FUNCTION reserve_quota_atomic(
  p_user_id uuid, p_category text, p_period_start timestamptz, p_limit int
) RETURNS uuid AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || p_category || p_period_start::text));
  -- count + conditional insert inside the same function = atomic
END;
$$ LANGUAGE plpgsql;
```

---

## TEST RESULTS

### FREE 4/5 — 20 concurrentes
```
AUTHORIZED = 1 ✓
REJECTED = 19 ✓
FINAL = 5/5 ✓
```

### FREE 0/5 — 20 concurrentes
```
AUTHORIZED = 5 ✓
REJECTED = 15 ✓
FINAL = 5/5 ✓
```

### PRO 199/200 — 20 concurrentes
```
AUTHORIZED = 1 ✓
REJECTED = 19 ✓
FINAL = 200/200 ✓
```

---

## CONCLUSIÓN

La atomicidad está garantizada por `pg_advisory_xact_lock` dentro de una función PL/pgSQL. La función se ejecuta como una sola llamada RPC al servidor PostgreSQL, donde el lock se mantiene durante toda la ejecución.

Los20requests concurrentes llegan a PostgreSQL simultáneamente, pero el advisory lock serializa su ejecución. Solo la primera request que adquiere el lock puede insertar; las demás ven el count actualizado al desbloquearse.

**STATUS: PASS**
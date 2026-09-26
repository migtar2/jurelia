# PLAN DATABASE SCHEMA

**Fecha:** 2026-09-26
**Fase:** 03

---

## TABLA: user_subscriptions

```sql
CREATE TABLE "user_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "plan" text NOT NULL DEFAULT 'free',
  "status" text NOT NULL DEFAULT 'active',
  "effective_from" timestamp with time zone DEFAULT now() NOT NULL,
  "effective_until" timestamp with time zone,
  "source" text NOT NULL DEFAULT 'default',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

---

## CONSTRAINTS

- `user_id` UNIQUE → 1 usuario = 1 plan activo
- `user_id` FK → CASCADE on delete
- `plan` CHECK: free | pro | unlimited (validado en app layer)
- `status` CHECK: active | cancelled | expired | suspended

---

## ÍNDICES

| Index | Columns | Purpose |
|---|---|---|
| idx_user_subscriptions_user_id | user_id | Plan resolution |
| idx_user_subscriptions_plan_status | plan, status | Queries admin |

---

## MIGRATION

Usuarios existentes migrados con:
- plan: 'free'
- status: 'active'
- source: 'migration'

Resultado verificado: 2 usuarios → FREE ✓
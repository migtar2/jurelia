# Decisiones de estabilización de Jurelia (consolidado, reproducible)

- Fecha: 2026-11-16 · Orquestador. Resume la evidencia de los bloques 1–4 para dejar decisiones **reproducibles** y sus pasos de verificación.
- Árbol: `main@2cab9b0` = `origin/main`; solo documentación sin commitear.

## 1. Alias

- **Decisión (Miguel, opción A)**: dominio canónico **`jurelia.vercel.app`**. `cendoj-poc.vercel.app` queda como alias del despliegue (hoy ambos sirven el mismo despliegue `cendoj-3dth83iw4`, verificado con `vercel inspect`). `cendoj.jurelia.es` sigue sin vincular.
- Cualquier redirección o cambio de alias requiere autorización expresa + Spec Kit; hoy **no hay canonización en código** (`middleware.ts` solo pone cabeceras).
- Implicación verificada: la cookie de sesión es por dominio → dos dominios = dos sesiones con el mismo `AUTH_SECRET`.
- Verificación tras cada despliegue: `curl -s -D - https://<alias>/api/cendoj/status` → 200 healthy en ambos; `vercel inspect https://<alias>` → mismo despliegue.

## 2. Dependencia CENDOJ

- **Dependen de CENDOJ (verificado)**: `/api/cendoj/search|summarize|proposition|compare`, `/api/news/analyze` (ambos modos), `/api/news/compare`, `/api/documents/analyze|search-jurisprudence`, ejecución de alertas, herramientas de Lía.
- **Siguen funcionando sin CENDOJ**: login/sesión, CRUD de workspace (búsquedas, documentos, decisiones, noticias guardadas, carpetas, notas, etiquetas), CRUD de alertas, `/api/usage` — verificado con CENDOJ caído (lo guardado accesible, búsqueda degradada 503, recuperación al volver).
- Tiempos: cliente CENDOJ 120 s (`AbortSignal.timeout`), `/api/cendoj/status` 10 s, fetch de noticias 15 s con reintentos.
- Comportamiento verificado: caída suave (el servicio responde offline) → 503 passthrough y pantalla offline en portada; caída dura → `status` 503 y búsqueda **500 vacío** (caso del VPS; mejora propuesta: 503 amable, pendiente de aprobación).

## 3. Sesión

- Cookie `jurelia-session`: JWT HS256 con `AUTH_SECRET`, expiración 24 h, `httpOnly`, `secure` en producción, `sameSite=lax`, `path=/`. Verificación local (sin BD).
- **Verificado**: token expirado → 401 amable en API (`{"error":"No autenticado"}`) y tarjeta de login en UI; `/me` re-chequea el usuario contra BD (token válido de usuario inexistente → 401). Login/registro 201/200 con cookie; retorno `?next=` con `safeNext` (solo rutas internas) verificado en código; repetición en navegador pendiente del login en la extensión AutoGLM.
- Sesión por dominio (ver §1): documentar en las URLs oficiales.

## 4. Cuotas

- Motor atómico en BD (`reserve_quota_atomic`, reserva→ejecuta→commit/release) con flag **`QUOTA_ENFORCEMENT_ENABLED`** (OFF por defecto; ON en el servidor local de pruebas; valor en Vercel pendiente de confirmar).
- Plan FREE: 5 búsquedas/mes por categoría (periodo mensual UTC). **Verificado**: 429 `QUOTA_EXCEEDED` con contadores correctos; concurrencia 3/3 (1/19 y 5/15 exactos) contra Neon.
- Semántica verificada: un aborto de red **no** consume cuota (reserva liberada); un 503 limpio de CENDOJ **sí** consume — **decisión de producto pendiente**: liberar en cualquier no-200.
- Aislamiento: cuotas y recursos por usuario (403 en acceso cruzado verificado). **Sin concepto de despacho** — decisión bloqueante del contrato de integración (bloque 4).

## 5. Decisiones pendientes de Miguel

1. Aplicar o no los hallazgos (requieren Spec Kit): 500 amable en caída dura; liberar cuota en fallos limpios de CENDOJ; comprobar usuario antes de reservar cuota (FK); timeout explícito en la prueba de concurrencia.
2. Cuota por despacho (bloque 4) → reunión con Legaltechia.
3. Baja de las cuentas ficticias de prueba en Neon (`test.hermes.20261115`, `test.block2.a/b`, `test.block3.c`).
4. Autorizar commit/push de la documentación generada (memoria + registros de bloques 2–4 y este documento).
5. Navegador: **VERIFICADO** (7/7, Chrome headless con playwright-core contra `http://localhost:3000`): login `?next=` conserva destino y filtros, workspace con cuenta y búsqueda guardada, Lía oculta persistente, pantalla offline sin login/navegación y recuperación. Hallazgos operativos: usar `localhost` (no `127.0.0.1`) en QA de navegador con `next dev`; el tour de bienvenida bloquea `/auth/login` en primera visita.

## Registros relacionados

- [Bloque 2](docs/codex-goals/2026-11-16-bloque2-sesion-busqueda-caida-jurelia.md) · [Bloque 3](docs/codex-goals/2026-11-16-bloque3-qa-jurelia.md) · [Bloque 4](docs/codex-goals/2026-11-16-bloque4-contrato-integracion-jurelia.md)

## SAFE_TO_COMMIT / SAFE_TO_PUSH / SAFE_TO_DEPLOY

**COMMIT/PUSH: SÍ** (`b5e92f1`, autorizado por Miguel el 2026-11-16); **DEPLOY: NO** — sin cambios de código.

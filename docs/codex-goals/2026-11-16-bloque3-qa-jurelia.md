# Bloque 3 — Verificación y operación (QA) de Jurelia

- Fecha: 2026-11-16 · `D:\app\cendoj\cendoj-poc` (`main@2cab9b0`). QA sobre el árbol integrado, sin cambios de código.
- Autorizaciones de Miguel: concurrencia contra Neon `jurelia-production` ✅, producción en solo lectura ✅, autoglm para navegador ✅.

## Resultado

**APROBADO (completo): cadena de compilación, verificaciones API y repetición de navegador aprobadas.**

### Cadena QA (binarios locales de `node_modules\.bin`)

| Comando | Resultado |
|---|---|
| `npm test` | **204/204** en 14 archivos (la concurrencia está excluida por diseño en `vitest.config.ts`) |
| `next typegen` (binario local) | ✓ tipos generados, exit 0 |
| `tsc --noEmit` | ✓ sin errores (tras borrar `.next/dev` corrupto por el cierre forzoso del dev server — caché, no código) |
| `npm run build` | ✓ Compiled successfully (44 rutas, exit 0) |

### Verificaciones repetidas (cuenta ficticia C, dev server + sustituto)

- Aislamiento: `DELETE` de C sobre búsqueda de A → **403 «Prohibido»**, recurso intacto. ✅
- CENDOJ caído: `status` offline, workspace C accesible (200), búsqueda degradada 503, recuperación tras volver. ✅
- `/api/feedback`: protegido por `getSession` (401 sin sesión) — **corrige el supuesto del bloque 1** (no hay hueco). ✅

### Concurrencia de cuotas (Neon, entorno autorizado)

- Config temporal `vitest.concurrency.config.ts` (borrada tras la ejecución; el árbol queda limpio).
- Intento 1 y 2: **fallo idéntico** — `Test timed out in 5000ms` en el caso PRO (199 INSERT secuenciales ≈ 5–9 s). Los dos casos FREE pasaban.
- Cambio de hipótesis: no es fallo del motor, es el timeout por defecto de vitest. Intento 3 con `--testTimeout 60000`: **3/3 PASS** (FREE 4/5, FREE 0/5, PRO 199/200 — 1/19 y 5/15 autorizadas exactas). El motor atómico (`reserve_quota_atomic`) es correcto.
- **Hallazgo**: la prueba carece de timeout explícito → falla con el default de 5 s en Neon. Propuesta (sin aplicar): `it(..., { timeout: 30_000 })` o `testTimeout` global; requiere autorización.

### Salud del proveedor y commit servido (producción, solo lectura)

- `GET /api/cendoj/status` en **`jurelia.vercel.app`** y **`cendoj-poc.vercel.app`**: ambos **200** `{"status":"healthy","headless":true,"service":"CENDOJ API & MCP"}` (servicio real del VPS sano).
- `vercel inspect https://jurelia.vercel.app` (CLI autenticada, solo lectura): el alias resuelve al despliegue **`cendoj-3dth83iw4`** (`dpl_4qRZnpLowfXDMsGqmxkbv2pcPo5D`, producción, Ready, creado 15-nov 19:40). El mismo despliegue lista el alias `cendoj-poc.vercel.app` → **ambos alias sirven el mismo despliegue**.
- Commit servido: el despliegue `cendoj-3dth83iw4` se creó desde `8eba1f5` según el registro del 15-11; `main@2cab9b0` solo añade documentación. El sha exacto no lo expone `vercel inspect`; verificarlo requiere el token de la API de Vercel (secreto) → queda como pendiente opcional.

### Pasos de comprobación de ambos alias (para repetir en cualquier despliegue)

1. `curl -s -D - https://<alias>/api/cendoj/status` → esperar 200 y `"status":"healthy"`.
2. `vercel inspect https://<alias>` → anotar despliegue (`General → id/created`) y confirmar que ambos alias resuelven al mismo despliegue.
3. Smoke con cuenta ficticia: login (201/200 + cookie), `/api/auth/me` 200, búsqueda 200 con resultados.

### Reversión documentada

- **Producción**: `vercel rollback cendoj-3dth83iw4` (o `vercel deploy` del commit anterior `6222b52` y re-apuntar alias con `vercel alias set`). La integración Git de Vercel no está activa: los despliegues son manuales.
- **Local**: árbol sin cambios de código en este bloque; en caso necesario `git restore .` (solo hay documentación sin commitear: `PROJECT_MEMORY.md` modificado y este registro).
- **Caché local**: si `tsc` volviera a fallar por artefactos corruptos: `Remove-Item .next\dev -Recurse -Force` y repetir `typegen` + `tsc`.

### Navegador (Chrome headless vía playwright-core, cuenta ficticia A)

Inicialmente bloqueado por la extensión AutoGLM (4 intentos: «Not logged in»). Se resolvió **sin extensión**: automatización propia con `playwright-core` sobre Chrome del sistema (`scratch/browser/browser-checks.js`), entrando por **`http://localhost:3000`**. Resultado: **7/7 PASS** + capturas en `scratch/block2-evidence/` (`browser-01-workspace.png`, `browser-02-lia-hidden.png`, `browser-03-offline.png`, `browser-04-online.png`, `browser-05-portada-sesion.png`).

| Comprobación | Resultado |
|---|---|
| Página hidratada (React enganchado) | PASS (`__reactFiber`/`__reactProps` presentes) |
| Login `?next=` vuelve a `/workspace?q=despido` | PASS (auth 200; URL con filtro conservado) |
| Workspace muestra la cuenta y la búsqueda guardada del bloque 2 | PASS (captura con `test.block2.a…` y «Busqueda ficticia A despido») |
| Portada muestra el nombre en cabecera | PASS |
| Lía oculta y persiste tras recargar | PASS (`jurelia-lia-hidden=1`, botón desaparece) |
| Pantalla offline con CENDOJ caído | PASS («SERVICIO CENDOJ NO DISPONIBLE», sin login ni navegación, con «Reintentar conexión») |
| Recuperación: portada vuelve a ONLINE | PASS |

**Hallazgos del navegador (operativa):**

1. **`next dev` bloquea la hidratación al entrar por `127.0.0.1`** (protección de orígenes: el origen legítimo es `localhost`). Síntoma: el formulario hace submit nativo (`/auth/login?`), no hay petición a `/api/auth/login` y `localStorage` no se escribe. **Para QA local en navegador usar `http://localhost:3000`.**
2. **Tour de bienvenida con overlay z-100** («Saltar / Siguiente») cubre también `/auth/login` en la primera visita y bloquea los clics hasta descartarlo (mejora de UX candidata: no mostrar el tour en rutas de autenticación).

### Pendientes

- Revisión independiente: sin verificador configurado en el árbol de agentes → esta QA queda registrada como pendiente de revisión independiente.
- Cuentas ficticias (bloques 2 y 3) en Neon pendientes de baja.
- Hallazgos sin aplicar: timeout explícito en la prueba de concurrencia; 500 amable en caída dura; cuota en fallos limpios de CENDOJ (bloque 2).

### SAFE_TO_COMMIT / SAFE_TO_PUSH / SAFE_TO_DEPLOY

**NO / NO / NO** — sin cambios de código; solo documentación nueva sin commitear.

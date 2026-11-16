# Bloque 2 — Sesión, búsqueda, caída de CENDOJ, permisos y cuotas (Jurelia)

- Fecha: 2026-11-16 · Orquestador en `D:\app\cendoj\cendoj-poc` (`main@2cab9b0`, árbol limpio al inicio).
- Objetivo del bloque: verificar expiración y retorno de sesión, búsqueda y noticia (URL y texto), documento original y coincidencia, caída/lentitud de CENDOJ con sustituto controlado, acceso a lo guardado y recuperación, visibilidad de Lía, permisos multi-cuenta y cuotas en el servidor.
- Entorno: `npm run dev` en `127.0.0.1:3000` con `QUOTA_ENFORCEMENT_ENABLED=true`; sustituto CENDOJ `scratch/mock-cendoj.py` en `127.0.0.1:8000` (datos 100% ficticios); BD Neon `jurelia-production` con dos cuentas ficticias `test.block2.a.20261116@example.com` y `test.block2.b.20261116@example.com` (pendientes de baja, como la cuenta del 15-11).

## Resultado

**APROBADO a nivel API (29 comprobaciones), con 2 hallazgos de producto/robustez y navegador pendiente (bloque 3).**

### Evidencia principal (matriz ejecutada: `scratch/block2-api-tests.ps1` + `scratch/block2-fixup.ps1`)

| Comprobación | Resultado |
|---|---|
| Registro cuentas ficticias | 201 + cookie `jurelia-session` |
| `/api/auth/me` con/sin cookie | 200 `{user:{email}}` / 401 |
| Login correcto / contraseña incorrecta | 200 + cookie / 401 |
| Token expirado (JWT forjado con `AUTH_SECRET` local, exp en pasado) | 401 `{"error":"No autenticado"}` en búsqueda; 401 `{user:null}` en `/me` |
| Búsqueda autenticada contra sustituto | 200, resultado ficticio `STS 1234/2026`, bloque `_quota` presente |
| Búsqueda sin sesión | 401 |
| Noticia por texto pegado | 200, `extractor:"pasted"`, `http_status:0`, ROJ extraído, `match: VERIFIED` con candidato `STS 1234/2026` |
| Noticia por URL privada | 400 «Acceso a localhost/loopback bloqueado» (guardia SSRF funciona) |
| Noticia por URL pública | PENDIENTE: sin salida web desde esta máquina (`curl https://example.com` → 000); el fallo de red acaba en 500 genérico (hallazgo 2) |
| Documento original (pdf ficticio del sustituto) | 200 con ROJ |
| Guardar búsqueda / listar / aislamiento | 201; A la ve, B no; `DELETE` de B sobre recurso de A → 403 «Prohibido», recurso intacto |
| Cuota visible en `/api/usage` | `free`, `jurisprudence_search` used/limit/remaining correctos |
| Cuota agotada (FREE = 5/mes) | 429 `QUOTA_EXCEEDED` con `used=5, remaining=0` |
| Caída suave (sustituto responde offline) | `status` 200 `{status:"offline"}`; lo guardado accesible (200); búsqueda 503 degradada; recuperación 200 al volver |
| Caída dura (sin listener en 8000) | `status` 503 `{status:"offline"}`; búsqueda **500 genérico sin cuerpo** (caso del timeout VPS reproducido); recuperación tras reiniciar el sustituto |
| Respuesta lenta 15 s | 200 con 15,7 s de latencia tolerada |
| Cuota en fallos | Un 503 limpio de CENDOJ **sí consume** cuota; un aborto de red **no consume** (reserva liberada) — hallazgo 1 |
| Lía y noticias (unit) | `npx vitest run tests/lia tests/news` → 76/76 |

### Hallazgos (sin cambios de código; decidir antes de tocar nada)

1. **Semántica de cuota en fallos**: `/api/cendoj/search` devuelve un objeto de error cuando CENDOJ responde 503, y `withQuota` solo libera la reserva cuando la operación *lanza*. Resultado: una búsqueda fallida por caída del proveedor consume cuota del abogado. Decisión de producto: liberar cuota en cualquier no-200 del proveedor (requiere cambio + Spec Kit).
2. **Caída dura → 500 opaco**: si el fetch a CENDOJ aborta (timeout/refused), la excepción se relanza desde `withQuota` y no hay `try/catch` en la ruta: el usuario recibe 500 vacío. Es exactamente el incidente transitorio del 15-11. Mejora propuesta: capturar y devolver 503 con mensaje amable y diagnóstico (Spec Kit pendiente).
3. **Sesión válida con usuario borrado**: token firmado válido de un `userId` inexistente → `/me` 401 correcto, pero la búsqueda produce 500 por violación de FK en `reserve_quota_atomic`. Robustez: comprobar existencia de usuario antes de reservar cuota.
4. **URL-mode sin egress local**: imposible probar E2E aquí; pendiente de entorno con salida web o prueba en despliegue (requiere autorización).
5. De bloque 1: `/api/feedback` no importa `requireAuth` — pendiente de verificación en bloque 3.
6. **Lía**: lógica cubierta por 76 pruebas; la persistencia de visibilidad (`localStorage jurelia-lia-hidden`) solo es verificable en navegador → pendiente bloque 3.

### Archivos

- Repo: **sin cambios de código**. Nuevo registro: este archivo.
- Fuera del repo (`D:\app\cendoj\scratch\`): `mock-cendoj.py` (sustituto controlado), `block2-api-tests.ps1`, `block2-fixup.ps1`, `expiry-test.mjs` y evidencias JSON en `block2-evidence\`.
- Servidores de prueba quedan corriendo: dev en `127.0.0.1:3000` (cuotas ON), sustituto en `127.0.0.1:8000`.

### Riesgos y pendientes

- Cuentas ficticias de bloque 2 en Neon pendientes de baja (decisión igual que la del 15-11).
- Cambios propuestos por los hallazgos 1–3: ninguno aplicado; requieren Spec Kit y autorización.
- Verificación independiente: sin verificador configurado en el árbol de agentes → pendiente de revisión independiente (bloque 3).
- Navegador (login `?next=`, pantalla offline con nav, Lía): pendiente bloque 3; autoglm no está configurado en este entorno.

### SAFE_TO_COMMIT / SAFE_TO_PUSH / SAFE_TO_DEPLOY

**COMMIT/PUSH: SÍ** (`b5e92f1`, autorizado por Miguel el 2026-11-16); **DEPLOY: NO** — sin cambios de código que desplegar.

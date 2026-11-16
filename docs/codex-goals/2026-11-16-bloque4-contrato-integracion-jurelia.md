# Bloque 4 — Primer contrato de integración Jurelia ↔ Portal/Previa (borrador)

- Fecha: 2026-11-16 · Coordinador, en `D:\app\cendoj\cendoj-poc`. Sin cambios de código; solo preparación.
- Base: `specs/001-ecosistema-legaltechia/spec.md` FR-003 y FR-004, `tasks.md` T007, `plan.md` (orden del piloto) y la arquitectura verificada de Jurelia en los bloques 1–3.

## La acción única propuesta: «búsqueda de jurisprudencia delegada»

Una sola operación que el portal (Previa) puede invocar sobre Jurelia, con respuesta verificable:

1. **Llamada**: `GET https://jurelia.vercel.app/api/cendoj/search?query=…` (o `roj`/`ecli`/`n_resolucion`/`n_recurso`) con cabecera `Authorization: Bearer <token de servicio del portal>` y contexto del usuario final (`x-despacho-id`, `x-usuario-email`) para auditoría.
2. **Respuesta verificable**: la misma que hoy devuelve la ruta (verificado en bloques 2–3): `{ total, results[], _elapsed_ms, _quota: { category, used, limit, remaining, period_end } }`. El portal puede verificar el éxito (200), la cuota restante del despacho y la degradación (503/429) sin estados intermedios.
3. **Qué NO incluye**: resúmenes IA, noticias, workspace ni documentos. Una sola acción para empezar; el resto se aprueba después.

## Permiso del despacho

- El **portal** es quien decide si un despacho puede ver la acción: comprueba su contratación de Jurelia (sus entitlements) antes de mostrar el menú (FR-003) y no llama a Jurelia si no está contratado.
- Jurelia solo ejecuta la búsqueda y responde; **no** concede ni revoca contratos.

## Revocación

1. Portal: retirar la contratación del despacho → el menú oculta la acción inmediatamente.
2. Jurelia: invalidar/rotar el token de servicio del portal (mecanismo a definir: lista de tokens por `x-despacho-id` con estado activo/revocado).
3. Ambos caminos se prueban en el entorno de pruebas antes de producción.

## Degradación

- Si Jurelia o CENDOJ no responden: el portal muestra el módulo como «no disponible» y conserva el enlace al acceso directo (`jurelia.vercel.app`), que sigue operativo con su propia pantalla offline (comportamiento verificado en bloque 2: lo guardado permanece accesible).
- Si la cuota del despacho se agota: la respuesta `429 QUOTA_EXCEEDED` (verificada) se muestra al usuario sin romper el portal.

## Riesgos y condiciones previas (a resolver con el equipo de Legaltechia)

1. **Jurelia no tiene concepto de despacho hoy**: sus usuarios son individuales y la cuota es por usuario. El aislamiento entre despachos (T007) exige decidir: (a) cuota por despacho en Jurelia (cambio de esquema, requiere Spec Kit), o (b) el portal agrega la cuota de sus usuarios. **Esta es la decisión bloqueante del contrato.**
2. El token de servicio debe ser un secreto nuevo, gestionado aparte (nunca reutilizar `AUTH_SECRET` ni `CENDOJ_SERVICE_TOKEN`).
3. Dominio canónico A (`jurelia.vercel.app`) ya decidido; el contrato usa ese dominio.

## Orden propuesto con el equipo (antes de habilitar nada)

1. Reunión Legaltechia: confirmar la acción única y resolver la decisión de despacho/cuota (riesgo 1).
2. Escribir el caso de uso final en `specs/001-ecosistema-legaltechia/contratos/integraciones.md` (T007) — lo redacta el equipo; este borrador es la entrada.
3. Spec Kit del cambio mínimo en Jurelia (token de servicio + mapeo despacho si aplica) y prueba de aislamiento entre despachos con datos ficticios.
4. Habilitar solo en pruebas y, después, producción, con revocación y degradación ya probadas.

## Calendario

- **Preparación objetivo: 11–22 de enero de 2027**, si el portal y el servicio CENDOJ están listos (según el cierre del orquestador).
- El piloto del ecosistema sigue siendo Previa+AnodatIA primero; Jurelia se añade cuando este contrato esté aprobado (plan.md).

## Verificación pendiente de este contrato

- Nada se habilita sin: token de servicio emitido y rotable, respuesta 200/429/503 comprobada desde el portal de pruebas, revocación y degradación probadas, y aislamiento entre dos despachos ficticios verificado.
- Revisión independiente: sin verificador configurado en el árbol de agentes → pendiente.

## SAFE_TO_COMMIT / SAFE_TO_PUSH / SAFE_TO_DEPLOY

**NO / NO / NO** — borrador documental sin commitear; la habilitación real requiere el acuerdo del equipo de Legaltechia y autorización expresa de Miguel.

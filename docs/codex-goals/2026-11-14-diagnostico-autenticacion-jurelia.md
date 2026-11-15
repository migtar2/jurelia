# Diagnóstico de autenticación de Jurelia

- Fecha: 2026-11-14.
- Proyecto: Jurelia, `D:\app\cendoj\cendoj-poc`, repositorio `migtar2/jurelia`.
- Objetivo inicial: investigar el aviso «No autenticado», comprobar las dependencias y preparar instrucciones de recuperación para Hermes o DeepSeek. Revisión de solo lectura y documentación local.

## Archivos revisados y modificados

- Revisados: `AGENTS.md`, `README.md`, `CURRENT_ARCHITECTURE.md`, `.vercel/project.json` (metadatos de enlace), `app/page.tsx`, rutas `app/api/auth`, `app/api/cendoj/search`, `app/api/cendoj/status` y `app/api/news/analyze`, `lib/auth`, `lib/db` y `lib/cendoj/client.ts`. También `../docs/08_OPERATIONS.md` y `../docs/15_DECISIONS_ADR_INDEX.md`.
- Creados: `PROJECT_MEMORY.md` y este registro en `docs/codex-goals/`. Código y `AGENTS.md` sin cambios.

## Comprobaciones y resultado

- `git status --short --branch`, `git remote -v`, `git log`, `git grep`, `rg` y `git diff f312855..HEAD`. Árbol limpio al inicio. El MCP de GitHub confirmó `6222b52` como `main`. El alias `cendoj-poc.vercel.app` sirve `f312855` en estado `READY`, según Vercel. La diferencia de commits afecta a Lía y sus pruebas. El historial local de rutas, librerías y dependencias no mostró referencias a Supabase ni Pipedream.
- Neon MCP confirmó `jurelia-production`. El servidor de base de datos estaba en reposo al consultar su estado. La consulta `SELECT 1 AS reachable, to_regclass('public.users') IS NOT NULL AS users_table_exists` devolvió `1` y `true`. Prueba de acceso vía MCP, sin validar la conexión desde Vercel. Supabase MCP no mostró un proyecto identificado como Jurelia o CENDOJ.
- Vercel MCP recibió `200` y `healthy` en `/api/cendoj/status`. La consulta agrupada de errores y fallos críticos de producción no mostró entradas en la ventana de 30 minutos consultada. Las pruebas de `/api/auth/me` y `/api/cendoj/search` quedaron bloqueadas en la capa de acceso de la herramienta de Vercel. PowerShell no pudo resolver los dominios probados. Vercel devolvió `404` al buscar el dominio histórico `cendoj.jurelia.es` en el equipo consultado.
- El guard de sesión explica el mensaje exacto de la captura y se ejecuta antes de cuotas y CENDOJ. La captura contiene una URL de prensa en el buscador general. El análisis de noticias es un flujo distinto y también exige sesión. Sin prueba autenticada queda pendiente establecer qué invalidó o impidió el envío de la cookie.

## Estado final y siguiente paso

- Diagnóstico y traspaso listos. Prueba funcional, cambios de aplicación y despliegue pendientes. No se ha ejecutado la suite de pruebas. No hay commit ni push.
- Reproducir en el dominio real con una cuenta de prueba. Comprobar login, `/api/auth/me`, búsqueda por concepto o ROJ y análisis de una URL pública. Si el login devuelve `500`, contrastar registros y metadatos de configuración con Neon. Si hay sesión válida pero falla CENDOJ, distinguir el `401` de sesión del `401` del servicio y comprobar el proxy. Revisar el dominio y su posible cambio antes de plantear cualquier modificación de infraestructura.
- Riesgos y recordatorio: la cookie de sesión depende del dominio y caduca a las 24 horas. El estado `healthy` comprueba acceso al servicio de estado y no demuestra que la búsqueda autenticada funcione. Conservar autenticación, cuotas y validaciones al mejorar la experiencia o aceptar texto de prensa. Mantener aparte la opción para ocultar a Lía.

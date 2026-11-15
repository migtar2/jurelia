# Memoria de Jurelia

Actualización del 14 de noviembre de 2026. Repositorio `migtar2/jurelia`, con raíz local en `D:\app\cendoj\cendoj-poc`. La carpeta superior contiene documentación histórica de CENDOJ Intelligence.

## Estado y arquitectura

- Frontend y rutas API en Next.js. El proyecto Vercel `cendoj-poc` sirve el alias verificado `cendoj-poc.vercel.app`. Al revisar, servía `f312855`, mientras que GitHub `main` estaba en `6222b52`. La diferencia afecta a Lía y sus pruebas.
- Postgres en Neon (`jurelia-production`) mediante Drizzle y `DATABASE_URL`. El inicio de sesión es propio. Firma la cookie `jurelia-session` con `AUTH_SECRET` y caduca a las 24 horas. El inicio de sesión consulta Neon. La comprobación de la cookie es local al servidor de Next.js.
- `/api/cendoj/search` busca conceptos y referencias. `/api/news/analyze` recibe una URL de noticia y la analiza. Ambos requieren sesión y aplican cuotas. El servicio CENDOJ corre en un VPS y se configura con `CENDOJ_API_URL` y `CENDOJ_SERVICE_TOKEN`. No se encontraron dependencias de Supabase ni Pipedream en los flujos revisados.

## Último bloque y pendientes

- **Desplegado en producción el 2026-11-15** con autorización de Miguel: commit `8eba1f5` (push a `migtar2/jurelia`), despliegue `cendoj-3dth83iw4` y alias `jurelia.vercel.app` re-apuntado (estaba en un despliegue de hace 50 días; la integración Git de Vercel no está activa: desplegar con `vercel deploy --prod --yes` y `vercel alias set`). Verificado en producción con cuenta de prueba: login, búsqueda y texto pegado correctos en `jurelia.vercel.app` y `cendoj-poc.vercel.app`.
- Mejoras de sesión, texto de noticia y avatar de Lía (2026-11-15). La causa del aviso «No autenticado» era que la portada no gestionaba la sesión y mostraba en crudo el `401` de `lib/auth/guard.ts`. Ahora la portada tiene cabecera de sesión, tarjeta de acceso con retorno a la URL original (`?next=`), análisis de noticias por texto pegado (`text` en `/api/news/analyze`, módulo `lib/news/pasted.ts`), opción de ocultar a Lía persistente y diagnóstico de búsqueda automática con estado HTTP real; la tarjeta compartida `components/AuthRequiredCard.tsx` cubre también `/compare`, `/proposition` y `/news-compare`, que sufrían el mismo error en crudo. Verificado con 204/204 pruebas, `tsc` limpio, `next build` completo y recorrido en navegador con mock de CENDOJ. Sin commit ni despliegue. [Registro](docs/codex-goals/2026-11-15-mejoras-sesion-noticia-lia-jurelia.md)
- La copia `D:\app\legaltekia\apps\jurelia` quedó sincronizada con estos cambios y pasa `tsc` y 204/204 pruebas ([registro](../legaltekia/docs/codex-goals/2026-11-15-sincronizacion-jurelia.md)). Pendiente retirar la cuenta de prueba ficticia `test.hermes.20261115@example.com` de Neon si no se necesita.
- La ruta de trabajo original de Jurelia sigue siendo `D:\app\cendoj\cendoj-poc`. El dominio `cendoj.jurelia.es` figura en documentación histórica, con vinculación actual sin confirmar.

Detalle en [el registro de diagnóstico](docs/codex-goals/2026-11-14-diagnostico-autenticacion-jurelia.md). Informe de traspaso completo para Codex (qué se hizo, archivos, verificación y siguientes pasos): [2026-11-15-informe-traspaso-codex-jurelia.md](docs/codex-goals/2026-11-15-informe-traspaso-codex-jurelia.md).

# Auditoría de seguridad y preparación de release

Fecha de revisión: 2026-08-10

## Alcance

Se revisaron la API Express, el frontend React/Vite, las librerías compartidas,
las migraciones Drizzle, la configuración de Vercel, el flujo de autenticación y
la carga de imágenes.

## Controles ejecutados

- API: 24 pruebas, todas aprobadas.
- Frontend: 13 pruebas, todas aprobadas.
- Contrato OpenAPI: 2 pruebas, todas aprobadas.
- Typecheck completo del monorepo: aprobado.
- Build de API y frontend: aprobados.
- `git diff --check`: aprobado.
- Escaneo de patrones de secretos en archivos rastreados: 0 coincidencias.
- Búsqueda de `SUPABASE_SERVICE_ROLE_KEY`/`service_role` en el bundle frontend:
  0 coincidencias.
- `pnpm audit --prod`: 0 vulnerabilidades conocidas después de fijar
  DOMPurify `3.4.13`, versión que corrige el hallazgo moderado transitivo de
  jsPDF detectado durante esta revisión.

## Cambios aplicados

- Los límites de usuario y contraseña se validan antes de ejecutar `scrypt`.
- Los intentos de login se guardan en PostgreSQL, con ventana de 15 minutos y
  límite de cinco intentos por clave de origen; las sesiones vencidas se limpian.
- Se usa un hash equivalente para usuarios inexistentes para reducir diferencias
  de tiempo observables.
- Los errores internos tienen logs del servidor y respuestas genéricas.
- Las imágenes se validan por MIME, tamaño y firma binaria; SVG queda rechazado.
- En producción, productos y banners usan URLs firmadas de Supabase Storage.
  El navegador nunca recibe la service-role key.
- La carga multipart a través de la API queda bloqueada en producción; el
  fallback de disco existe únicamente para desarrollo local.
- Al eliminar o reemplazar imágenes de productos y banners se intenta eliminar
  también el objeto remoto.
- Se añadieron CSP, `Permissions-Policy`, `X-Frame-Options` y otros headers.
- La tasa de cambio usa una clave única e inserción idempotente.
- Las hojas de cálculo locales quedaron excluidas de Git para evitar publicar
  datos fuente por accidente.

## Pendientes antes de publicar

Estos puntos requieren el proyecto real de Supabase y las variables de Vercel;
no se pueden validar completamente sin esas credenciales:

1. Ejecutar las migraciones en una base Supabase limpia y comprobarlas allí.
2. Crear los buckets públicos de lectura `products` y `banners`, sin escritura
   anónima, y probar subida, reemplazo y eliminación.
3. Crear el administrador con el seed interactivo y probar login, logout y
   rate limit entre invocaciones serverless.
4. Validar el JSON final derivado del Excel, importar con `--replace` y confirmar
   el conteo definitivo de productos.
5. Configurar variables de Preview y Production en Vercel, crear un Preview
   Deployment y verificar rutas SPA, CORS y conexión mediante pooler.

## Rendimiento y frontend

- Se retiró la directiva de framework ajena a Vite que estaba asociada al aviso
  de sourcemap de `tooltip.tsx`.
- `/admin` y `/producto/:slug` se cargan bajo demanda.
- React, TanStack Query y Framer Motion tienen chunks compartidos estables.
- El bundle inicial pasó de 639,05 kB a 328,09 kB minificados y el build dejó de
  emitir advertencias de chunks mayores a 500 kB.
- La revisión responsive de 1440, 768 y 390 px no encontró desbordamiento
  horizontal ni overlays de error.

No se hizo push a GitHub ni despliegue a Vercel durante esta auditoría porque el
proyecto Supabase, sus variables secretas y el destino de producción todavía no
están configurados en este entorno.

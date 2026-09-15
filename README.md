# Catalogo Publiex Maracaibo

Web publica de Publiex Maracaibo para consultar productos, seleccionar variantes,
armar un carrito y enviar pedidos por WhatsApp. Incluye una consola protegida para
administrar catalogo, categorias, ofertas, banners, tasa USD/Bs, analitica y
presupuestos.

## Arquitectura

```text
artifacts/catalogo/      React 19 + Vite + Tailwind
artifacts/api-server/    Express 5
lib/api-spec/            Contrato OpenAPI
lib/api-client-react/    Cliente React generado
lib/api-zod/             Validadores generados
lib/db/                  PostgreSQL + Drizzle y migraciones
api/                     Entrada serverless de Vercel
```

La web y el administrativo de escritorio son repositorios coordinados, con ciclos
de despliegue independientes. Vercel despliega solamente este repositorio.

## Desarrollo local

Requisitos: Node.js 24 y pnpm.

```powershell
pnpm.cmd install
pnpm.cmd dev
```

La API usa el puerto `8080` y Vite el `5173` por defecto. Las variables requeridas
se documentan con placeholders en `.env.example`; nunca se versionan credenciales.

## Verificacion

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd audit --prod
```

## Reglas del catalogo

- Un precio exacto de `0` es valido y se presenta como `Gratis`; no equivale a un
  precio ausente.
- `stockQuantity` comunica disponibilidad publica: `0` significa por encargo. No
  representa un sistema completo de inventario.
- Las variantes legacy permanecen en `products.sizes` mientras esta web siga usando
  el esquema actual.
- El navegador nunca recibe `DATABASE_URL`, claves secretas ni service-role keys.

## Operacion y despliegue

- `SPEC.md`: invariantes funcionales y tecnicas del repositorio.
- `ADMIN_SETUP.md`: creacion y mantenimiento del acceso administrativo.
- `SUPABASE_DEPLOY.md`: preparacion de PostgreSQL, Storage y variables de Vercel.
- `SECURITY_AUDIT.md`: controles aplicados y pendientes de release.

La rama funcional de referencia es `agent/publish-catalog-updates`. Antes de
publicar se deben aplicar migraciones en el proyecto correcto, configurar las
variables directamente en Vercel, crear el administrador y probar un Preview de
extremo a extremo.

# Preparacion para Supabase y Vercel

El proyecto usa PostgreSQL mediante Drizzle. La migracion de la estructura y la
carga de productos son procesos separados para no mezclar datos de prueba con
la base definitiva.

## 1. Crear la base en Supabase

En Supabase crea un proyecto y copia la cadena desde **Connect**.

- Para aplicar migraciones desde el equipo local usa la conexion directa o de
  sesion.
- Para Vercel/serverless usa el pooler en modo transaccion, normalmente en el
  puerto `6543`.

La contrasena nunca se guarda en Git ni se pega en el codigo.

## 2. Aplicar la estructura

En `.env.local` coloca temporalmente la URL de migracion:

```text
DATABASE_URL=postgresql://...
PORT=8080
```

Luego ejecuta desde la raiz:

```powershell
pnpm.cmd run db:migrate
```

No uses `db:push` en produccion. Las migraciones quedan guardadas en
`lib/db/drizzle/` y son reproducibles.

## 3. Preparar el archivo definitivo

Cuando el Excel final este completo, se convierte al JSON intermedio que
consume `db:import`. La hoja de imagenes puede permanecer vacia por ahora.

## 4. Reemplazar los productos de prueba

Antes de ejecutar esto verifica que la URL apunte a la base correcta y guarda
un respaldo si ya existe informacion importante:

```powershell
$env:CONFIRM_REPLACE = "YES"
pnpm.cmd run db:import -- --file .\ruta\catalogo.json --replace
Remove-Item Env:CONFIRM_REPLACE
```

`--replace` elimina unicamente los registros de `products` dentro de una
transaccion. No elimina usuarios, sesiones ni la tasa de cambio.

## 5. Crear el administrador

Despues de migrar y cargar productos:

```powershell
pnpm.cmd run db:seed
```

El comando solicita usuario y contrasena localmente y guarda solo el hash.

## 6. Variables en Vercel

En **Project Settings -> Environment Variables** configura:

- `DATABASE_URL`: pooler de Supabase para transacciones/serverless.
- `CORS_ORIGINS`: solo si el frontend y la API quedan en dominios distintos.

Con la configuracion actual de Vercel, frontend y API usan el mismo dominio y
`CORS_ORIGINS` normalmente no es necesario.

## 7. Storage para productos y banners

En Supabase crea dos buckets publicos de lectura:

- `products`
- `banners`

La lectura es publica para que el catalogo pueda mostrar las imagenes. La
escritura y eliminacion se controla desde la API mediante URLs firmadas y la
service-role key. No se debe crear una politica de escritura anonima.

La API usa la service-role key unicamente en el servidor; nunca la expongas al
frontend. En `.env.local` y en Vercel configura:

```text
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
SUPABASE_STORAGE_BUCKET=banners
SUPABASE_PRODUCT_STORAGE_BUCKET=products
```

En desarrollo local, si `NODE_ENV` no es `production` y las variables de
Supabase no estan configuradas, la API usa automaticamente `uploads/` como
almacenamiento temporal. Esos archivos quedan fuera de Git y sirven solo para
probar la consola local.

En produccion el navegador solicita `POST /api/uploads/sign`, sube directamente
al bucket con la URL firmada y finaliza con `POST /api/uploads/complete`. La
service-role key nunca viaja al navegador ni atraviesa GitHub.

Productos y banners aceptan hasta 5 MiB por imagen. La interfaz optimiza JPG,
PNG y WEBP a WebP antes de subirlos; el servidor verifica tambien la firma
binaria y rechaza archivos falsificados o SVG.

El carrusel acepta hasta 10 banners y los registra mediante
`POST /api/banners/from-storage`. Al borrar o reemplazar imagenes se intenta
eliminar tambien el objeto remoto para evitar basura.

Las imagenes no se guardan dentro de PostgreSQL: los productos conservan sus
URLs y la tabla de banners conserva `storage_path`.

## 8. Estadisticas

La tabla `analytics_events` registra unicamente eventos comerciales agregados:
clics en agregar al carrito e intenciones de envio por WhatsApp. No guarda
datos personales ni el contenido del pedido.

La migracion correspondiente ya fue aplicada a la base Supabase conectada. En
otros entornos se aplica con:

```powershell
pnpm.cmd run db:migrate
```

Para que Admin consulte visitas, paginas, rutas, dispositivos y referidos de
Vercel, configura en **Project Settings -> Environment Variables**, solo para
la API:

```text
VERCEL_ANALYTICS_TOKEN=tu-token-de-vercel
VERCEL_PROJECT_ID=prj_...
VERCEL_TEAM_ID=team_...   # opcional si el proyecto pertenece a un equipo
```

El token nunca se incorpora al frontend. Si falta, la pantalla continua
mostrando la actividad comercial disponible y marca el trafico de Vercel como
no configurado.

## 9. Verificaciones antes de Vercel

```powershell
pnpm.cmd test
pnpm.cmd run typecheck
pnpm.cmd --filter @workspace/api-server run build
pnpm.cmd --filter @workspace/catalogo run build
```

Prueba en Preview: `/api/healthz`, `/api/products`, `/api/banners`, login,
subida de una imagen de producto, subida de un banner y refresco directo de
`/admin` y de una pagina de producto.

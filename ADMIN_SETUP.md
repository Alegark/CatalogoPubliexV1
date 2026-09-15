# Acceso administrativo

La consola `/admin` usa las tablas `users` y `sessions` de PostgreSQL. La contraseña
se guarda únicamente como hash en `users.password_hash`; nunca va al frontend,
Git, `localStorage` ni variables permanentes del despliegue.

## Configuración local

1. Crea `.env.local` en la raíz del repositorio. Está excluido por `.gitignore`.

   ```text
   DATABASE_URL=postgresql://...
   PORT=8080
   ```

2. Genera y aplica la migración:

   ```powershell
   pnpm.cmd run db:generate
   pnpm.cmd run db:migrate
   ```

3. Crea el administrador de forma interactiva:

   ```powershell
   pnpm.cmd run db:seed
   ```

   El terminal solicita usuario y contraseña sin guardar credenciales en `.env`.
   Si ejecutas el comando otra vez con el mismo usuario, actualiza su hash: sirve
   también para restablecer la contraseña.

4. Inicia la aplicación:

   ```powershell
   pnpm.cmd run dev
   ```

   Frontend: `http://localhost:5173`  
   API: `http://localhost:8080/api/healthz`

## Supabase y Vercel

Configura únicamente `DATABASE_URL` en cada entorno. Para la API serverless usa
la conexión pooler de Supabase recomendada para conexiones de corta duración.
Ejecuta `db:migrate` desde una terminal local o CI con esa misma URL antes del
primer despliegue. Ejecuta `db:seed` una vez para crear el administrador.

## Seguridad

- La cookie de sesión es `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
- La cookie contiene un token aleatorio; la base de datos almacena solo su hash.
- Las sesiones expiran en ocho horas.
- Cinco intentos fallidos por IP bloquean nuevos intentos durante quince minutos.
- Crear, editar y eliminar productos, además de cambiar la tasa, exige sesión.
- No compartas `DATABASE_URL` ni la contraseña con el chat.

# SPEC

## GOAL

Catalogo, compra consistente, pedido WhatsApp, administracion segura.

## CONSTRAINTS

- Conservar React/Vite + Express + PostgreSQL/Drizzle.
- Dinero en centavos; descuentos e IVA tienen fuente unica.
- Credenciales nunca en frontend, Git ni `localStorage`.
- `DATABASE_URL` es unico secreto persistente de aplicacion; `PORT` solo infraestructura local.

## INTERFACES

- web: `/`, `/producto/:slug`, `/admin`
- api: `/api/products`, `/api/exchange-rate`, `/api/auth/*`
- local: `pnpm.cmd run dev`, `pnpm.cmd run db:migrate`, `pnpm.cmd run db:seed`
- deploy: `api/index.mjs`, `vercel.json`

## INVARIANTS

V1: tests TypeScript ejecutados directo por Node usan imports relativos con extension `.ts`.
V2: operaciones OpenAPI sensibles conservan ruta API exacta y cliente generado.
V3: credencial admin persistida usa hash en `users.password_hash`; nunca plaintext ni env frontend.
V4: sesion usa cookie HttpOnly con token aleatorio; DB almacena solo SHA-256(token).
V5: build Vercel usa `api/index.mjs` con app compilada; listener local queda separado.
V6: scripts Node directos de DB resuelven todos los imports relativos con extension `.ts`.

## TASKS

id|status|task|cites
T1|x|centralizar precios, carrito, IVA, WhatsApp|-
T2|x|proteger administracion con sesion servidor|I.api
T3|x|cerrar verificacion funcional|V1,V2
T4|x|terminar responsive y apariencia|-
T5|x|persistir usuarios, sesiones y seed admin en PostgreSQL|V3,V4
T6|x|preparar Vercel: handler, rewrites, scripts y migraciones|V5,I.api

## BUGS

id|date|cause|fix
B1|2026-07-24|Node ESM no resolvio import relativo sin extension en test HTTP|V1
B2|2026-07-24|test HTTP importo barrel generado con rutas ESM sin extension|V1
B3|2026-07-24|updateExchangeRate quedo anidado bajo auth/logout en OpenAPI|V2
B4|2026-07-24|seed directo no resolvio imports DB sin extension ni barrel de schema|V6

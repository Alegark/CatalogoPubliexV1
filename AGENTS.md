# AGENTS.md

## Autoridad

1. El requisito explicito del propietario prevalece.
2. `SPEC.md` define invariantes y alcance funcional de esta web.
3. `README.md` documenta estructura, comandos y estado operativo.
4. `SECURITY_AUDIT.md`, `ADMIN_SETUP.md` y `SUPABASE_DEPLOY.md` cubren sus areas
   especializadas.

No crear archivos de contexto de conversacion ni memorias paralelas.

## Rama y limites

- Trabajar desde `agent/publish-catalog-updates`; `main` no es la baseline actual.
- Mantener este repositorio separado de `App_Administracion_Publiex`.
- No cambiar PostgreSQL, Supabase, Vercel ni el contrato OpenAPI sin una decision
  explicita y verificada.
- No guardar secretos, datos de clientes ni exportaciones productivas en Git.
- No eliminar migraciones ni regenerar clientes sin revisar el diff resultante.

## Reglas de negocio

- Precio `0` significa `Gratis`; `null` o ausencia de precio no significan gratis.
- `stockQuantity === 0` comunica `Por encargo`, no inventario agotado.
- Las variantes web legacy viven en `products.sizes`; la normalizacion a
  `product_variants` pertenece al adaptador de migracion del administrativo.

## Verificacion obligatoria

Ejecutar antes de entregar cambios:

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd audit --prod
```

Para cambios visuales, comprobar al menos movil, tablet y escritorio, navegacion por
teclado, foco visible y ausencia de desbordamiento horizontal.

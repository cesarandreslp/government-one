# Government One — Rebuild (bitácora)

> Reconstrucción greenfield limpia del SaaS multi-tenant para entidades públicas colombianas.
> Carpeta nueva al lado de la app vieja (`../personeriabuga/`), que se conserva **solo como
> referencia** — NO se migran sus datos (fueron pruebas).

## Reglas de oro del rebuild (no romper)

1. **Greenfield limpio.** No se migran datos de Armenia ni de ningún tenant (eran pruebas). Se
   re-siembran tenants de prueba cuando haga falta. Sin strangler-fig-con-datos.
2. **Data-driven, cero hardcode de entidad, cero fallbacks a medida.** Lo que se muestra sale SIEMPRE
   de la data cargada. Sin dato = estado vacío/configurable, nunca un valor inventado. El código NO
   conoce ninguna entidad; solo primitivos + catálogos nacionales (CCPET, CGC, festivos, Res. 1519,
   catálogo de módulos) + plantillas por *tipo* de entidad (editables, semilla no quemada).
3. **Fundación primero, luego módulo por módulo verificado EN VIVO** antes de pasar al siguiente.
4. **Stack:** Next.js + Prisma + PostgreSQL (**Neon, BD por tenant**, aislamiento fuerte) + Vercel.
   Confirmado y arquitecturado para **escala masiva agresiva** (ver `VERIFICACION_neon_escala.md`).
5. **El plano de control es producto de primera clase.** Nunca más migraciones a mano.

## Orden de construcción (la columna vertebral)

1. **Fundación** (2 mitades, ambas antes de cualquier módulo):
   - **Plano de control** (infra): provisioning asíncrono + orquestación de migraciones + ruteo de
     tenant + secretos por tenant + meta-DB. → `FUNDACION_plano_de_control.md`
   - **Fundación de dominio**: árbol de dependencias + `Cargo` + vínculo persona↔cargo + ruteo VU.
     → `FUNDACION_estructura_organizacional.md`
2. **Módulo base (Portal Institucional)** = Portal + Gestión Documental + Ventanilla Única + creación
   de la estructura organizacional. (Bundle indivisible.)
3. **Financiero (contabilidad = libro mayor)** — la columna donde todo postea.
4. **Presupuesto** → **Banco de proyectos** → **Contratación** → inventario/almacén → nómina → …
   Cada uno se enchufa al anterior; la integración transparente nace de fábrica.

## Documentos de diseño (cerrados sobre terreno verificado)
- `FUNDACION_estructura_organizacional.md` — fundación de dominio. **Sólida (usuario, 2026-07-12).**
- `FUNDACION_plano_de_control.md` — fundación de infraestructura / escala.
- `VERIFICACION_neon_escala.md` — tarea de verificación de límites Neon (B1/B2 con Neon-sales pendientes).

## Decisiones ya tomadas (no relitigar sin motivo)
- Roles → **capacidades** para el ciclo contractual (estructurar/revisar_juridica/concepto_juridico/
  supervisar); roles quedan como identidad (SUPER_ADMIN/ADMIN/USER/CONTRATISTA).
- Autorización de acción sobre un contrato = **capacidad (vía cargo) Y FK por-contrato**.
- Contratista = identidad externa; supervisor = funcionario; interventor = tercero externo contratado.
- BD por tenant, definitiva. Provisioning y migraciones automáticas desde el día cero.

## Infraestructura provisionada (2026-07-12, vía Vercel CLI)

- ✅ **Repo GitHub:** `github.com/cesarandreslp/government-one` (rama `main`).
- ✅ **Proyecto Vercel:** `cesar-lozanos-projects/government-one` (`prj_uzWN…`), creado + linkeado por CLI.
- ✅ **Neon (meta-DB) provisionada vía Vercel** (`vercel integration add neon`): recurso `neon-blue-pillow`,
  conectado al proyecto; env vars en `.env.local` (gitignored). Claves útiles: `POSTGRES_PRISMA_URL`
  (pooled, runtime), `POSTGRES_URL_NON_POOLING` / `DATABASE_URL_UNPOOLED` (directo, migraciones),
  `NEON_PROJECT_ID`. Esta Neon = **meta-DB** del control plane; los tenant-DB se provisionan luego con el
  orquestador (Neon API).
- ✅ **Auto-deploy GitHub→Vercel conectado** (`vercel git connect`, tras autorizar la app de Vercel en el
  repo privado). Push a `main` → Vercel despliega solo.

## Progreso — Plano de control, brick 1: meta-DB (2026-07-13)

- ✅ **Prisma 7** configurado (¡ojo, difiere de versiones previas!):
  - Generator `prisma-client` (NO `prisma-client-js`) → salida a `src/generated/prisma` (gitignored).
  - La **URL de conexión va en `prisma.config.ts`** (no en el schema): `datasource.url` = `POSTGRES_URL_NON_POOLING`
    (directa, para migraciones/shadow DB). Carga `.env` vía `dotenv/config`.
  - El **cliente runtime requiere un driver adapter** (ya no hay `datasourceUrl`): `@prisma/adapter-pg` + `pg`,
    con la URL **pooled** (`DATABASE_URL`). Ver `src/lib/prisma-meta.ts`.
  - `migrate dev` **NO** auto-genera el cliente en Prisma 7 → correr `prisma generate` aparte (y `postinstall`
    lo hace en Vercel).
- ✅ **Schema meta-DB** (`prisma/schema.prisma`): modelo `Tenant` (slug, nombre, tipoEntidad, dominioPrincipal/
  Personalizado, `neonProjectId`, `databaseUrl`/`databaseUrlDirect` cifradas, `secretosEncriptados`,
  `schemaVersion`, `estadoProvision`) + enum `TenantEstadoProvision`. Es el **directorio de la flota**.
- ✅ **Migración `init_meta_db` aplicada a la meta-DB Neon real** (tabla `tenants`).
- ✅ **Verificado en vivo** (`scripts/verify-meta.ts`, `npx tsx`): `tenants = 0` — cliente + adapter + Neon OK.
- ✅ **Commit `c3e9aa0` + push + deploy `READY`** en Vercel (build con `prisma generate` funciona).

## ⏭️ Recomendación para mañana (orden del plano de control)

1. **Encryption util** (AES-256-GCM) — para cifrar `databaseUrl`/`secretosEncriptados` del tenant. Pequeño, base de todo lo siguiente.
2. **Superadmin: CRUD de tenants** sobre la meta-DB (crear/listar) — verificable en vivo.
3. **Provisioning de tenant** (crear su BD Neon vía **Neon API** + aplicar schema del tenant + guardar connString cifrada + `estadoProvision`). ⚠️ Necesita un **`NEON_API_KEY`** de cuenta (atar a B3 de `VERIFICACION_neon_escala.md`).
4. **Ruteo de tenant** (host → tenant → cliente Prisma de su BD).
5. **Orquestador de migraciones** (versionadas + fan-out) — el #1 del plano de control.

Luego: **fundación de dominio** (schema del tenant: Dependencia + Cargo + VinculacionCargo + Usuario), y recién ahí el módulo base (Portal+GD+VU).

> **Estado:** infra + meta-DB (brick 1 del control plane) listos, desplegados y verificados. Retomar por el
> punto 1 de la recomendación.

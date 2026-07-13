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

## Progreso — Plano de control, brick 2: encryption + provisioning (2026-07-13)

- ✅ **`src/lib/encryption.ts`** — AES-256-GCM (`encrypt`/`decrypt`/`encryptJson`/`decryptJson`), clave en
  `ENCRYPTION_KEY` (32 bytes hex, en `.env`, gitignored). Verificado en vivo (`scripts/verify-crypto.ts`):
  round-trip string/JSON + detección de manipulación (authTag) OK.
- ✅ **`src/lib/provisioning/neon.ts`** — crear/borrar proyecto Neon vía API v2. La `NEON_API_KEY` es
  **org-scoped** (org "CESAR" = `org-fragrant-hat-12076614`; `/users/me` da 404 pero se resuelve el `org_id`
  vía `/users/me/organizations`, que ya hace `getOrgId()`). Devuelve directUrl + pooledUrl (deriva `-pooler`).
- ✅ **`src/lib/provisioning/provision.ts`** — `provisionTenant()`: registro meta-DB (CREANDO_NEON) → crea BD
  Neon dedicada → guarda `databaseUrl`/`databaseUrlDirect` **cifradas** + `neonProjectId` (APLICANDO_SCHEMA) →
  **rollback** (borra proyecto Neon + marca FALLIDO) si falla.
- ✅ **Verificado EN VIVO** (`scripts/test-provision.ts`): provisionado el **tenant demo** con su propio
  proyecto Neon (`young-silence-83309176`), connStrings cifradas en la meta-DB, y **conexión a la BD del
  tenant** (SELECT 1 = 1) OK. → la arquitectura DB-por-tenant + cifrado funciona de punta a punta.
- ✅ **Commit `e52fd99` + push + deploy `READY`**.
- ⚠️ **Pendientes de este brick:** (a) **aplicar el schema del tenant** a su BD (necesita la fundación de
  dominio) y luego marcar `ACTIVO`; (b) agregar **`NEON_API_KEY` + `ENCRYPTION_KEY` a las env de Vercel**
  antes de provisionar desde producción; (c) al provisionar, registrar el `dominioPersonalizado` del tenant
  en Vercel (API de dominios) — recordatorio del usuario: los tenants configuran su propio dominio.
- 🗑️ **Dato:** existe un tenant demo real en Neon (`young-silence-83309176`) — borrable con `deleteNeonProject`.

## Progreso — Brick 3: schema del tenant (fundación de dominio v1) + ruteo (2026-07-13)

- ✅ **Segunda schema de Prisma** `prisma/tenant/schema.prisma` (aparte de la meta-DB): núcleo de la
  fundación de dominio → `Dependencia` (árbol, `tipo`, `esServicioCompartido`), `Cargo` (bundle `grants`
  Json, `esJefatura`), `Usuario` (rol identidad: SUPER_ADMIN/ADMIN/USER/CONTRATISTA), `VinculacionCargo`
  (TITULAR/ENCARGADO/PROVISIONAL + `actoAdmin` + desde/hasta), `Ausencia`. Genera cliente aparte en
  `src/generated/tenant` (gitignored; `postinstall` genera AMBOS clientes en Vercel).
- ✅ **`prisma/tenant/provision-schema.sql`** (generado con `prisma migrate diff --from-empty --to-schema …
  --script`) — el DDL del tenant, versionable, que se aplica a cada BD de tenant.
- ✅ **`src/lib/provisioning/schema-apply.ts`** (`applyTenantSchema`): ejecuta ese SQL contra la BD del
  tenant (pg + connString directa). Cableado en `provisionTenant` → tras aplicar, estado `ACTIVO`, `schemaVersion=1`.
- ✅ **`src/lib/tenant-db.ts`** — RUTEO: `resolveTenantByHost` (subdominio gestionado **O** `dominioPersonalizado`)
  + `getTenantPrisma(host)` (descifra connString → cliente Prisma del tenant). (Caché por-tenant: pendiente para escala.)
- ✅ **VERIFICADO EN VIVO** (`scripts/test-routing.ts`): schema aplicado a la BD del tenant demo → ACTIVO;
  `getTenantPrisma("demo.ossgovernmentone.lat")` **ruteó y ESCRIBIÓ** en la BD propia del tenant (creó
  "Secretaría de Planeación"; dependencias 0→1). → multi-tenant runtime completo, punta a punta.
- ✅ **Commit `1b15ef9` + push + deploy `READY`** (build genera meta + tenant clients en Vercel).

## ⏭️ Recomendación para el siguiente tramo

1. **Superadmin (meta-DB): CRUD de tenants + botón "provisionar"** (usa `provisionTenant`) — primera UI
   verificable en navegador (nuestro método). Necesita: agregar `NEON_API_KEY`+`ENCRYPTION_KEY` a env de Vercel.
2. **Ampliar la fundación de dominio** en el schema del tenant: helpers de acceso (capacidades efectivas =
   unión de cargos vigentes), "quién ejerce el cargo hoy", y seed de plantillas por tipo de entidad (editable).
3. **Orquestador de migraciones** (versionadas + fan-out sobre las BDs de tenant) — el #1 del control plane;
   formalizar `prisma/tenant/migrations` + `schemaVersion` por tenant.
4. **Registrar `dominioPersonalizado` en Vercel** al provisionar (API de dominios) + caché de ruteo host→tenant.
5. Cache de clientes Prisma por-tenant (evitar churn de conexiones en serverless).

Luego: **módulo base** (Portal + Gestión Documental + Ventanilla Única + estructura organizacional).

> **Estado:** control plane (meta-DB + encryption + provisioning) **y** fundación de dominio v1 + ruteo,
> todo desplegado y **verificado en vivo** (tenant demo con su BD Neon dedicada, escritura vía su subdominio).
> Retomar por el **Superadmin (CRUD/provisionar tenants)** — la primera UI.

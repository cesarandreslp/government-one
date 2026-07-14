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

## Progreso — Brick 4: Superadmin (1ª UI) — CRUD/provisionar tenants (2026-07-13)

- ✅ **`NEON_API_KEY` + `ENCRYPTION_KEY` agregadas a env de Vercel** (Production + Development, vía
  `vercel env add` por stdin). ⚠️ **Preview** quedó pendiente (quirk del CLI: pide rama de git; no bloquea —
  Preview solo aplica a deploys de PR; se puede agregar en el dashboard).
- ✅ **`src/app/superadmin/tenants/`** — primera UI (Next 16, App Router, server components + server action):
  - `page.tsx` (server component): lista los tenants de la meta-DB (tabla con slug/nombre/tipo/dominio/estado).
  - `provision-form.tsx` (client, `useActionState`): formulario slug/nombre/tipoEntidad → "Provisionar".
  - `actions.ts` (`"use server"`): `provisionTenantAction` valida + llama `provisionTenant` + `revalidatePath`.
  - Convenciones Next 16 confirmadas en `node_modules/next/dist/docs` (server actions, `revalidatePath`).
- ✅ **Verificado en vivo** (dev server :3100, HTML SSR vía curl — el navegador in-app se colgó): la página
  renderiza "Superadmin — Tenants" + formulario + el tenant demo (Alcaldía Demo · demo.ossgovernmentone.lat ·
  ALCALDIA · ACTIVO). La lista lee la meta-DB OK. `provisionTenantAction` envuelve el `provisionTenant` ya
  probado end-to-end.
- ✅ **Commit `9a4812a` + push + deploy `READY`**.
- ⚠️ **Notas:** (a) **falta AUTH** de superadmin de plataforma (hoy protegido solo por el SSO de Vercel del
  deployment); (b) provisionar SÍNCRONO desde la UI **timeoutea en Vercel Hobby** (~10s) — a escala va como
  job asíncrono (orquestador); en local funciona; (c) test de click-to-provisionar en navegador pendiente
  (pane in-app inestable) — la función está probada.

## ⏭️ Recomendación para el siguiente tramo

1. **Auth de plataforma** (login de superadmin) — antes de exponer el Superadmin fuera del SSO de Vercel.
2. **Ampliar la fundación de dominio** en el schema del tenant: helpers de acceso (capacidades efectivas =
   unión de cargos vigentes), "quién ejerce el cargo hoy", seed de plantillas por tipo de entidad (editable).
3. **Orquestador de migraciones** (versionadas + fan-out; formalizar `prisma/tenant/migrations` + `schemaVersion`).
4. **Provisioning asíncrono** (cola/worker) — para no topar el timeout de Vercel; + registrar `dominioPersonalizado`
   en Vercel (API de dominios) + caché de ruteo host→tenant + caché de clientes Prisma por-tenant.

Luego: **módulo base** (Portal + Gestión Documental + Ventanilla Única + estructura organizacional).

> **Estado:** control plane (meta-DB + encryption + provisioning) + fundación de dominio v1 + ruteo + **primera
> UI (Superadmin de tenants)**, todo desplegado y verificado en vivo. Retomar por **auth de plataforma** o
> **ampliar la fundación de dominio** (helpers de acceso + plantillas de cargo).

## Progreso — Landing corporativa de la plataforma (2026-07-14)

- ✅ **`src/app/page.tsx`** — reemplaza la página por defecto de create-next-app por la **landing corporativa
  de OSS Government One**: nav (marca + "Acceso administrativo"), hero (propuesta de valor), 4 valores
  (aislamiento por entidad / modular por contrato / integración transparente / hecho para el sector público
  CO), **catálogo de módulos** (Portal Institucional = "Fundación"; Financiero, Presupuesto, Banco de
  Proyectos, Contratación, Nómina/Tesorería/Inventarios = "Planeado"), y footer. CTA a `/superadmin/tenants`
  (acceso administrativo SaaS — provisional hasta que exista el auth/login de plataforma).
- ✅ **Estructurada para el CMS futuro:** módulos y valores viven como arreglos de datos (`MODULOS`, `VALORES`)
  con placeholders "Pantallas del módulo · próximamente" → migrarán al **CMS del Superadmin (meta-DB)** sin
  reproceso, y cada módulo se llenará con **capturas reales** a medida que se construya.
- ✅ `layout.tsx`: metadata Government One + `lang="es"`.
- ✅ **Verificado en vivo** (dev :3100, `read_page`): render completo, cero errores de consola. `tsc --noEmit`
  limpio. **Commit `4bf8976` + push + deploy prod `READY`**.
- ⏭️ **Siguiente pedido del usuario:** **CMS en el Superadmin** para administrar esta landing y otras páginas
  del SaaS (contenido de módulos + capturas en la meta-DB). Nota: hoy el deploy sigue tras el SSO de Vercel;
  al exponer la landing pública hay que **desactivar ese SSO** y montar el auth de plataforma para
  `/superadmin/*`.

## Progreso — Auth de plataforma (login del superadmin) (2026-07-14)

Orden acordado con el usuario: **(1) auth → (2) CMS → (3) exponer landing (quitar SSO)**. Esto es el (1).

- ✅ **Modelo `AdminPlataforma`** en la meta-DB (migración `20260714141457_add_admin_plataforma`, aplicada a
  Neon). Contraseña **solo como hash bcrypt** (`bcryptjs`, 12 rounds); nunca en claro.
- ✅ **Sesión stateless con `jose`** (JWT HS256 en cookie httpOnly, 7 días). Split intencional:
  - `src/lib/session.ts` — cripto pura (firmar/verificar), **sin `next/headers`** para poder usarse en el proxy.
  - `src/lib/session-cookies.ts` — set/get/delete de la cookie (`server-only`, `next/headers`).
- ✅ **`src/proxy.ts`** — ⚠️ **Next 16 renombró `middleware`→`proxy`** (archivo `proxy.ts`, `export function
  proxy`, corre en Node; confirmado en `node_modules/next/dist/docs/.../proxy.md`). Chequeo **optimista**:
  `/superadmin/*` sin sesión → `/login?next=…`; con sesión en `/login` → `/superadmin/tenants`.
- ✅ **DAL `src/lib/dal.ts`** (`requerirAdmin` con React `cache`) = cerradura real cerca de los datos.
  `src/app/superadmin/layout.tsx` la aplica a todo `/superadmin/*` + shell (email + botón "Salir").
  `provisionTenantAction` ahora exige sesión.
- ✅ **`/login`**: `page.tsx` (searchParams como Promise — Next 16) + `login-form.tsx` (`useActionState`) +
  `actions.ts` (`loginAction` valida credenciales, crea sesión, redirige; `logoutAction`). CTAs de la landing → `/login`.
- ✅ **`src/lib/auth.ts`** `verificarCredenciales` (bcrypt compare + `ultimoIngreso`; comparación señuelo para no
  filtrar por temporización si el email existe).
- ✅ **Seed sin exponer contraseña:** `scripts/seed-admin.ts` lee `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` del
  entorno (upsert). **El usuario debe correrlo** para crear el primer admin (aún no hay ninguno).
- ✅ **Verificado en vivo:** proxy redirige `/superadmin/tenants`→`/login` (navegador); `scripts/verify-auth.ts`
  probó contra la meta-DB real bcrypt (correcta/incorrecta) + jose (firma/verifica con `SESSION_SECRET` real) +
  limpieza → 0 admins. `tsc --noEmit` limpio. Sin errores de consola.
- ✅ **`SESSION_SECRET`** generado y en env de Vercel (Production+Development) y `.env` local (gitignored).
- ✅ **Commit `1b98db6` + push + deploy prod `READY`**.

### 🔑 Acción pendiente del USUARIO (para poder entrar)
Crear el primer superadmin (yo no manejo tu contraseña):
1. En `government-one/.env` agrega `SUPERADMIN_EMAIL=tu@correo` y `SUPERADMIN_PASSWORD=<≥10 chars>` (opcional `SUPERADMIN_NOMBRE`).
2. `cd government-one && npx tsx scripts/seed-admin.ts`
3. Borra la línea `SUPERADMIN_PASSWORD` de `.env`.
Esto escribe en la **meta-DB de producción** (el `.env` local apunta a la Neon real), así que ya podrás
entrar en el deploy — una vez se quite el SSO de Vercel (paso 3 del plan).

## Progreso — CMS del Superadmin (paso 2/3) (2026-07-14)

- ✅ **Modelos `PaginaCms` + `BloqueCms`** en la meta-DB (migración `add_cms`). Una página = bloques
  ordenados; `BloqueCms.contenido` es **JSON tipado por `tipo`** (hero, lista_valores, lista_modulos);
  `clave` estable por bloque (`@@unique([paginaId, clave])`). Genérico → sirve para la landing y otras
  páginas del SaaS.
- ✅ **`src/lib/cms.ts`**: tipos de contenido de la landing (`HeroContenido`, `Valor`, `Modulo`…) +
  `obtenerPagina(slug)` / `bloque(pagina, clave)`.
- ✅ **Landing data-driven:** `src/app/page.tsx` ahora lee del CMS (`force-dynamic`); sin texto de plataforma
  quemado. Sin datos → estado vacío discreto. Soporta **capturas por módulo** (URLs) con placeholder
  "próximamente" mientras no haya storage.
- ✅ **Superadmin:** `/superadmin/cms` (lista de páginas) + `/superadmin/cms/[slug]` (editor). Editores cliente
  hero/valores/módulos (agregar/quitar, `useActionState`) → `guardarBloqueAction` (`"use server"`, exige
  `requerirAdmin`, `revalidatePath("/")`). Nav Tenants/CMS en el layout.
- ✅ **`scripts/seed-cms.ts`** siembra la landing en la meta-DB (idempotente) — ya corrido contra prod.
- ✅ **Verificado EN VIVO:** (a) landing sirve del CMS; (b) editar un bloque por script se refleja en la
  landing; (c) **guardado real por la UI** (server action con sesión de prueba efímera inyectada) → "Guardado.";
  (d) proxy protege `/superadmin/cms`. Admin efímero de verificación borrado (0 admins). `tsc` limpio.
- ✅ **Commit `c69b3b3` + push + deploy prod `READY`**.

## ⏭️ Paso 3/3 pendiente — exponer la landing (quitar SSO de Vercel)

- La landing pública y `/login` ya están listas; `/superadmin/*` protegido por auth propio. Falta **desactivar
  la Deployment Protection (SSO) de Vercel** para que `government-one.vercel.app` muestre la landing al público.
- **Prerrequisito recomendado:** que el usuario **siembre su admin** (`scripts/seed-admin.ts`) antes/después de
  exponer, para poder entrar (sin admin, `/superadmin` queda inaccesible aunque el sitio sea público → seguro).
- Exposición = acción outward-facing → **confirmar con el usuario** el momento antes de flipear a público.

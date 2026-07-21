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

## Progreso — Exponer la landing (paso 3/3) (2026-07-14) ✅ HECHO

- ✅ Usuario **sembró su superadmin** (`scripts/seed-admin.ts`): `superadmin@government-one.com`, activo, hash
  bcrypt válido (verificado en la meta-DB; su contraseña nunca la vio Claude).
- ✅ **SSO de Vercel desactivado** (con autorización explícita del usuario): `PATCH /v9/projects/{id}` con
  `ssoProtection: null` (antes estaba `all_except_custom_domains`). La landing y `/login` quedan públicos.
- ✅ **Verificado en producción:** `government-one.vercel.app/` → 200 sirviendo la landing del CMS (ya no la
  pantalla "Vercel Authentication"); `/login` → 200; `/superadmin/cms` → redirige a `/login?next=…` (el proxy
  protege el control plane en prod). El usuario ya puede entrar en prod con su admin.

> **Estado:** plan del usuario (1 auth → 2 CMS → 3 exponer) **completo y en producción**. La landing pública se
> administra desde el CMS del Superadmin, detrás de auth propio. Retomar por la **fundación de dominio restante**
> (helpers de acceso + plantillas de cargo) o el **módulo base** (Portal + GD + Ventanilla Única).

## Progreso — Fundación de dominio cerrada (helpers de acceso + plantillas) (2026-07-14)

- ✅ `src/lib/dominio/` (greenfield, sin reusar `accesos.ts` viejo): **`capacidades.ts`** (catálogo nacional +
  `Grants`/`unirGrants`/`grantsIncluyen`), **`acceso.ts`** (`capacidadesEfectivas`=unión de cargos vigentes,
  `tieneCapacidad`, `quienEjerce`, `usuarioAusente`, `cabezaDeDependencia`), **`plantillas-cargo.ts`**
  (`PLANTILLAS_POR_TIPO` ALCALDIA/PERSONERIA por *tipo*, editable; `aplicarPlantilla` idempotente).
- ✅ Detalle del diseño→código en `FUNDACION_estructura_organizacional.md` §8.
- ✅ **Verificado EN VIVO** (`scripts/verify-dominio.ts` contra la BD Neon del tenant demo): 11/11 asserts
  (plantilla→7 deps/11 cargos; encargo suma autoridad al cargo base; `quienEjerce` pasa de titular a encargado
  en ausencia; capacidad fuera del cargo negada; limpieza a 0). `tsc` limpio. **Commit `74706ea` + deploy READY**.

> **Estado:** fundación **completa** (plano de control + dominio, ambos con código y verificados en vivo) +
> plataforma pública (landing/CMS/auth). **Siguiente: MÓDULO BASE — Portal Institucional** (Portal + Gestión
> Documental + Ventanilla Única + estructura organizacional). Al cablear VU, resolver ruteo con `quienEjerce`.

## Progreso — Módulo Base, Paso A: estructura organizacional del tenant (2026-07-21)

Arranca el módulo base por el Paso A del `PLAN_modulo_portal.md`. **Decisión del usuario:** construir primero
la superficie **tenant-facing real** (con su propio auth de funcionario) y después la vista bajo Superadmin.
Todo en 3 bricks, cada uno espejando los patrones ya probados de la plataforma (Next 16 + Prisma 7).

**Brick 1 — credenciales + primitivas de sesión del tenant:**
- `Usuario.passwordHash String?` (tenant schema). `provision-schema.sql` regenerado (⚠️ Prisma 7 cambió el
  flag: `migrate diff --to-schema`, ya no `--to-schema-datamodel`). Columna aplicada al tenant demo con
  `scripts/migrate-usuario-passwordhash.ts` (idempotente, `ADD COLUMN IF NOT EXISTS`, recorre tenants ACTIVO
  desde la meta-DB — patrón interino hasta el orquestador fan-out).
- `src/lib/tenant-session.ts` (JWT jose atado a `tenantId`+`usuarioId`, cookie propia `g1t_session`),
  `tenant-session-cookies.ts`, `tenant-auth.ts` (`verificarCredencialesTenant` bcrypt contra la BD del tenant,
  con comparación señuelo). Espejo del auth de plataforma pero por-tenant.
- `scripts/seed-usuario-tenant.ts` — bootstrap del primer funcionario admin del tenant (credenciales por env,
  nunca en código; el usuario las maneja, como el superadmin).

**Brick 2 — contexto de tenant por host + ruteo + login:**
- `src/lib/contexto-tenant.ts` — `contextoTenant()` resuelve el tenant por `Host` (headers) → `{tenant, db}`,
  cacheado por render. **Override de DEV** (`DEV_TENANT_SLUG`, solo en localhost/no-producción) para trabajar
  local; en producción SIEMPRE por host.
- `src/lib/dal-tenant.ts` — `requerirFuncionario()` (exige sesión válida para el tenant del host; valida
  `sesion.tenantId === tenant.id`, defensa en profundidad) + `requerirRolTenant([...])` (rol identidad).
- Login del funcionario en `/ingresar` (page + form `useActionState` + `actions.ts`); tenant admin en
  `/admin/*` con su `layout.tsx` (shell + cerradura). `proxy.ts` ampliado: gatea `/admin/*`→`/ingresar` y
  `/ingresar`→`/admin/estructura`, conservando el gate de plataforma (`/superadmin`,`/login`). Cookies distintas
  por superficie (`g1_session` plataforma / `g1t_session` tenant), host-scoped → aislamiento entre tenants.

**Brick 3 — `/admin/estructura`:**
- `page.tsx` (server): árbol de dependencias + cargos (con grants y **quién ejerce** cada cargo vía
  `quienEjerce`), y tabla de funcionarios con sus **capacidades efectivas** (`capacidadesEfectivas`) — cablea
  la fundación de dominio de punta a punta en UI.
- `actions.ts` (server, gateadas por rol identidad ADMIN/SUPER_ADMIN del tenant): **sembrar estructura**
  (`aplicarPlantilla` por tipo de entidad, idempotente), crear dependencia, crear cargo, crear funcionario,
  crear vínculo persona↔cargo. `estructura-acciones.tsx` (client) con los formularios.
- Cierra el hueco "aplicarPlantilla existe pero no está cableado": ahora se dispara desde la UI (botón),
  no en `provision.ts` (evita el timeout de Vercel Hobby; el cableado async al provisionar queda para cuando
  exista el provisioning asíncrono).

**Verificación (contra la URL de Vercel, no local — preferencia del usuario):** `tsc --noEmit` y `eslint`
limpios (el único error de lint es preexistente en `scripts/verify-auth.ts`). Para verificar la superficie
tenant-facing en el deploy sin subdominios reales todavía, se apuntó **temporalmente** el
`dominioPersonalizado` del tenant demo a `government-one.vercel.app` (`scripts/set-tenant-host.ts`, reversible)
→ en esa URL, `/ingresar` y `/admin/*` resuelven al tenant demo (landing y `/superadmin` intactas). Funcionario
admin de prueba sembrado en el tenant demo para la verificación.

**✅ VERIFICADO EN VIVO en `government-one.vercel.app` (2026-07-21, tras deploy):**
- `/ingresar` resolvió **"Alcaldía Demo"** por host (ruteo por `dominioPersonalizado` en producción, HTTPS).
- Login con el funcionario admin del tenant → sesión `g1t_session` creada → redirigió a `/admin/estructura`
  (auth de funcionario + DAL `requerirFuncionario` + gate del proxy, todo OK en prod).
- **"Sembrar estructura"** → `✅ Estructura sembrada: 7 dependencias, 11 cargos nuevos.` — el árbol completo
  de la plantilla ALCALDIA renderizó con sus grants por cargo, badges de jefatura y servicio compartido, y
  cada cargo "sin ocupante".
- **Vincular** Admin Demo (TITULAR) → PLAN · Secretario de Planeación → `✅ Vínculo creado`; el cargo pasó a
  mostrar **`ejerce: Admin Demo · titular`** (`quienEjerce`) y el funcionario a **`capacidades efectivas:
  contratacion:elaborar, ventanilla_unica:responder`** (`capacidadesEfectivas` = unión de grants del cargo
  vigente). Fundación de dominio cableada de punta a punta, confirmada en producción.
- Nota: el screenshot del pane in-app se colgó (inestabilidad ya conocida); evidencia por lectura de página.

**Pendiente:** revertir el `dominioPersonalizado` del demo cuando haya subdominios reales; borrar el
funcionario de prueba del demo; config real de `*.ossgovernmentone.lat` en el proyecto Vercel.

**Siguiente:** Paso B (Gestión Documental: TRD + radicación), luego C (Ventanilla Única con ruteo por
`quienEjerce`) y D (portal público). Y la vista de estructura bajo Superadmin (opción 1). Las superficies
tenant-facing siguientes verifican en la misma URL de Vercel mientras el demo apunte ahí.

## Progreso — Módulo Base, Paso B: Gestión Documental (TRD + radicación) (2026-07-21)

Segunda sub-pieza del módulo base. Radicación con **consecutivo por tenant** + Tabla de Retención Documental
(TRD) como dato del tenant. Es donde se **cablea la fundación de dominio en el gating de acciones de módulo**.

**Modelo (tenant schema, aditivo):** `GdSerie` (Serie TRD por dependencia) → `GdSubserie` (retención gestión/
central + `GdDisposicion` CONSERVACION_TOTAL/ELIMINACION/SELECCION/DIGITALIZACION); `Radicado` (`numero`
único, `GdTipoRadicado` ENTRADA/SALIDA/INTERNO, `GdEstadoRadicado`, `dependenciaId`+`subserieId` opcionales,
`radicadoPorId`); `GdConsecutivo` (contador atómico `@@unique([tipo, anio])`); `GdAdjunto` (URL; el storage
por-tenant llega después). Back-relations en `Dependencia`/`Usuario`. `provision-schema.sql` regenerado (10
tablas). Número de radicado `E/S/I-AAAA-000001`, consecutivo atómico vía `upsert ... increment` en
`$transaction`.

**Migración a tenants existentes — `scripts/migrate-tenants-diff.ts` (NUEVO, migrador interino/fan-out):**
para cada tenant ACTIVO calcula el diff entre SU BD y el schema objetivo con `prisma migrate diff
--from-config-datasource --to-schema` (apuntando `POSTGRES_URL_NON_POOLING` a la BD directa del tenant; dotenv
no sobreescribe env ya presente) y aplica el delta con `pg`. Idempotente por diseño (si está al día, no hace
nada). `DRY_RUN=1` para inspeccionar. Anticipa el orquestador formal del plano de control. Delta aplicado al
tenant demo (5 tablas GD + 3 enums). ⚠️ Prisma 7 **quitó `--from-url`/`--to-url`**: solo `--from-empty/-schema/
-migrations/-config-datasource` (otro caso del AGENTS.md — verificar la CLI, no asumir).

**Gating por CAPACIDAD (fundación de dominio cableada):** `src/lib/dal-tenant.ts` → `funcionarioPuede(ctx,
modulo, cap)`: los admins del tenant (ADMIN/SUPER_ADMIN) pasan siempre (administran la entidad); el resto
necesita la capacidad conferida por un cargo vigente (`tieneCapacidad`). **Nada mira el rol para funciones de
módulo** — solo identidad-admin como bypass de administración. Todas las acciones de GD lo usan.

**UI (`/admin/gd`):** `page.tsx` (server) — KPIs por estado, TRD (series→subseries con retención/disposición),
**bandeja de radicados**; `gd-acciones.tsx` (client) — formularios de **Radicar** (tipo/asunto/tercero/rutear a
dependencia/clasificar en subserie), **Nueva serie** y **Nueva subserie**, mostrados según capacidad
(`puedeRadicar`/`puedeTrd`). `actions.ts` — `radicarAction` (consecutivo atómico), `crearSerieAction`,
`crearSubserieAction`, `cambiarEstadoAction`, todas gateadas por `funcionarioPuede`. Ítem "Gestión Documental"
en el nav del admin del tenant.

**Verificación:** `tsc --noEmit` y `eslint` limpios.

**✅ VERIFICADO EN VIVO en `government-one.vercel.app` con Claude in Chrome (2026-07-21):**
- TRD: creada serie **PLAN·100 Contratos** → subserie **100.10 Contratos de prestación de servicios**
  (retención 2/8 años, CONSERVACION_TOTAL); renderiza en la sección TRD.
- Radicación (3 documentos): **E-2026-000001** (Entrada, clasificado en la subserie + ruteado a Planeación),
  luego **S-2026-000001** (Salida) y **E-2026-000002** (Entrada) → confirma que el **consecutivo es atómico
  e independiente por (tipo, año)**: Entrada avanzó 000001→000002, Salida arrancó su propia serie en 000001.
- Los 3 aparecen en la **bandeja** con número/tipo/asunto/tercero/dependencia/estado (RADICADO); KPIs por
  estado correctos. Todo con el funcionario admin del tenant demo, en la URL de Vercel (no local).

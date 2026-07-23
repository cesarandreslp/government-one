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

## Progreso — Módulo Base, Paso C: Ventanilla Única (PQRSD con ruteo por cargo) (2026-07-21)

El **diferenciador**: la PQRSD entra y se **asigna automáticamente al funcionario que EJERCE el cargo
competente** — aquí la fundación de dominio (`quienEjerce`) deja de ser teoría y rutea trabajo real.

**Modelo (tenant schema, aditivo):** `Pqrsd` (`numero` único, `PqrsdTipo` P/Q/R/S/D, `PqrsdCanal`,
`PqrsdEstado` RECIBIDA/ASIGNADA/EN_TRAMITE/RESPONDIDA/CERRADA, peticionario, `dependenciaId`+`cargoAsignadoId`+
`usuarioAsignadoId`, términos de ley `diasTermino`/`fechaVencimiento`, respuesta) + `PqrsdConsecutivo` (atómico
por año, `PQRSD-AAAA-000001`). Back-relations en Dependencia/Cargo/Usuario. `provision-schema.sql` → 12 tablas;
delta aplicado al tenant demo con `migrate-tenants-diff.ts`.

**Ruteo por cargo — `src/lib/vu-ruteo.ts` (`resolverAsignacionVu`):** dada la dependencia competente, busca el
cargo con capacidad `ventanilla_unica:responder` (jefatura primero) y resuelve al ocupante con **`quienEjerce`**
(encargado→titular sin ausencia→…); fallbacks: **cabeza de la dependencia** → **dependencia de servicio
compartido** con capacidad VU (Atención al Ciudadano). Si nadie ejerce el cargo, la PQRSD queda RECIBIDA
asignada al cargo (sin ocupante). **La clave:** si el titular se ausenta y hay encargado, la siguiente PQRSD se
asigna al encargado sin tocar la regla de ruteo — la fundación de dominio hace el trabajo.

**Términos de ley — `src/lib/dias-habiles.ts`:** `sumarDiasHabiles`/`diasHabilesRestantes` (excluye fines de
semana; **festivos colombianos pendientes** — catálogo nacional a incorporar como CCPET/CGC). Semáforo en la
bandeja (verde/amarillo/rojo por días hábiles restantes; rojo = vencida).

**UI (`/admin/vu`):** KPIs (sin asignar / asignadas / respondidas / **vencidas**), **bandeja** con "asignada a"
(funcionario + cargo + dependencia) y semáforo de término; `vu-acciones.tsx` (client) — **Radicar PQRSD**
(tipo/canal/peticionario/asunto/descripción + dependencia competente que auto-rutea) y **Responder PQRSD**;
gateadas por capacidad `ventanilla_unica` (radicar/responder) vía `funcionarioPuede`. Ítem "Ventanilla Única"
en el nav. IA de clasificación (fase 2) omitida — el ruteo por reglas + cargo funciona sin IA (y cuando entre,
key IA POR-TENANT → [[regla-oro-credenciales-por-tenant]]).

**Verificación:** `tsc --noEmit` y `eslint` limpios.

**✅ VERIFICADO EN VIVO en `government-one.vercel.app` con Claude in Chrome (2026-07-21) — el diferenciador
funciona end-to-end:**
- Radicada **PQRSD-2026-000001** (Petición, dependencia competente = Planeación) → auto-asignada a **Admin
  Demo** (titular del cargo Secretario de Planeación), estado ASIGNADA, término 15d hábiles.
- En estructura: creada funcionaria **Beatriz Torres** y vinculada como **ENCARGADO** del mismo cargo
  (acto admin. "Decreto 045/2026 — encargo por vacaciones").
- Radicada **PQRSD-2026-000002** (misma dependencia competente, MISMA regla de ruteo) → auto-asignada a
  **Beatriz Torres** (la encargada). **`quienEjerce` dio precedencia al encargo** y reasignó la nueva PQRSD
  sin tocar la regla de ruteo — exactamente la promesa de la fundación de dominio (una persona = identidad,
  el trabajo va al cargo → a quien lo ejerce hoy). Ambas visibles en la bandeja con "asignada a" + cargo +
  dependencia + semáforo de término.

## Progreso — Subdominio real del tenant demo (2026-07-21)

El usuario pidió montar `*.ossgovernmentone.lat` **solo si no implicaba que él hiciera nada ni romper la prod
vieja**. Hallazgo al inspeccionar Vercel (solo lectura): el **proyecto viejo `ossgovermentone` tiene atados el
apex `ossgovernmentone.lat` + el wildcard `*.ossgovernmentone.lat`** y sigue vivo (sirve armenia/buga por el
wildcard). Nameservers del dominio = Vercel (DNS gestionado por Vercel; no requiere tocar registrador).

- **El wildcard NO se movió:** moverlo a government-one exige quitárselo al proyecto viejo primero, lo que
  **rompería toda la prod vieja** (`<tenant>.ossgovernmentone.lat` dejaría de resolver). Acción destructiva/
  hacia afuera → NO se hace sin decisión explícita de retirar la prod vieja.
- **Sí se hizo (limpio, reversible, sin acción del usuario):** `vercel domains add demo.ossgovernmentone.lat`
  → subdominio **específico** atado al proyecto `government-one`. Vercel resuelve el subdominio específico por
  encima del wildcard del otro proyecto, así que **solo `demo.` va al proyecto nuevo**; apex/armenia/buga de la
  prod vieja quedan intactos. El tenant demo ya tenía `dominioPrincipal = demo.ossgovernmentone.lat`, así que
  resolvió sin tocar la BD. Se **removió el apunte temporal** `dominioPersonalizado = government-one.vercel.app`
  (script `set-tenant-host.ts`) → estado correcto: `government-one.vercel.app` = solo plataforma (landing +
  superadmin), `demo.ossgovernmentone.lat` = tenant.
- **✅ Verificado:** `https://demo.ossgovernmentone.lat/ingresar` → 200, muestra "Alcaldía Demo · Acceso de
  funcionarios", SSL automático (Claude in Chrome + curl).
- Para que TODO tenant nuevo tenga subdominio automático se necesitaba el **wildcard** en government-one →
  ver la sección siguiente (el usuario decidió proceder).

## Progreso — Wildcard `*.ossgovernmentone.lat` movido a government-one (2026-07-21)

El usuario decidió el **wildcard completo** (subdominio automático por tenant), asumiendo explícitamente la
consecuencia: la prod vieja pierde el ruteo de sus subdominios. Reasignación vía **API de Vercel** (no CLI, para
precisión — mover el project-domain, no borrar el dominio de la cuenta):
- `DELETE /v9/projects/{ossgovermentone}/domains/*.ossgovernmentone.lat` → HTTP 200 (quitado del viejo).
- `POST /v10/projects/{government-one}/domains {name:"*.ossgovernmentone.lat"}` → `verified:true`, HTTP 200.
- Token del CLI en `AppData/Roaming/xdg.data/com.vercel.cli/auth.json`; team `team_DpR8…`; old
  `prj_4i9hQr9BrSAdFrPL1n4XnuMt6MLn`, new `prj_uzWNrMOU5xJ5vzd5UZgh6G26lBVf`.
- **Consecuencia (aceptada):** el proyecto viejo `ossgovermentone` conserva solo el apex `ossgovernmentone.lat`
  (+ `personeriabuga.vercel.app`); sus subdominios de tenant (`alcaldia-armenia`, `personeria-buga`) ahora
  resuelven a government-one → "Entidad no encontrada" (no están en la meta-DB nueva). La prod vieja era solo
  referencia (datos de prueba).

**✅ VERIFICADO end-to-end (Claude in Chrome + curl):**
- Subdominio arbitrario `zzz-test.ossgovernmentone.lat/ingresar` → servido por government-one ("Entidad no
  encontrada"), SSL instantáneo (cert wildcard) → el wildcard enruta CUALQUIER subdominio al app nuevo.
- **Prueba definitiva "tenant nuevo → subdominio automático":** `scripts/provision-tenant.ts` (nuevo, general,
  env-driven) provisionó "Alcaldía de Pinar" (BD Neon dedicada real); **`https://pinar.ossgovernmentone.lat/
  ingresar` mostró "Alcaldía de Pinar" sin NINGÚN paso manual de dominio** — el `provisionTenant` fija
  `dominioPrincipal=<slug>.ossgovernmentone.lat` y el wildcard lo resuelve solo. Tenant de prueba luego
  eliminado con `scripts/delete-tenant.ts` (nuevo; borra Neon + registro meta) → `pinar.` volvió a "Entidad no
  encontrada".
- `demo.ossgovernmentone.lat` sigue vivo (además tiene su entrada específica, redundante con el wildcard, se deja).

**Estado del ruteo:** `government-one.vercel.app` = plataforma; `*.ossgovernmentone.lat` = tenants (automático
por provisión). **Pendiente opcional (no pedido):** mover también el **apex** `ossgovernmentone.lat` a
government-one (hoy sigue sirviendo la landing vieja) si se quiere que el dominio raíz sea la landing nueva.

## Progreso — Módulo Base, Paso D: Portal público del tenant (2026-07-21)

Cierra el bundle base: el ciudadano entra por el host del tenant y ve SU portal (cero hardcode de entidad) +
radica PQRSD que cae en la Ventanilla Única del tenant.

**Ruteo de la raíz por HOST:** `src/app/page.tsx` ahora ramifica con `contextoTenant()` — host de tenant →
**portal del tenant** (`PortalTenant`); host de plataforma → landing corporativa (extraída a
`landing-plataforma.tsx`, sin cambios). Las rutas públicas (`/`, `/pqrsd`, `/transparencia`) NO están en el
matcher del `proxy.ts` → públicas sin sesión.

**Portal del tenant (`portal-tenant.tsx` + `portal-shell.tsx`):** cabecera con el **nombre real del tenant**,
hero Gov.co, **directorio de dependencias** (del árbol del tenant), y el menú **Transparencia** (12 categorías
Res. MinTIC 1519/2020, `src/lib/transparencia.ts` — primitivo NACIONAL, no dato de entidad; el contenido por
categoría es dato del tenant, hoy estado vacío "Sin publicar"). Shell reutilizado por las 3 páginas del portal.

**PQRSD pública (`/pqrsd`):** `RadicarForm` (público, sin sesión) → `radicarPublicoAction` resuelve el tenant
por host y crea la PQRSD (canal WEB) con **el mismo ruteo por cargo** que el admin; devuelve el número. Sin
elegir dependencia (el ciudadano no la conoce) → cae en el servicio compartido (Atención al Ciudadano) vía
`resolverAsignacionVu(db, null)`. `ConsultaForm` consulta por número (estado + términos + respuesta si la hay).
**Refactor DRY:** se extrajo `src/lib/pqrsd.ts` `crearPqrsd(db, input)` (consecutivo atómico + término de ley +
ruteo) usado por la acción admin y la pública — una sola fuente de verdad.

**Transparencia (`/transparencia`):** las 12 categorías obligatorias como esquema de publicación; contenido por
publicar (pendiente el modelo de micrositio en la BD del tenant).

**Verificación:** `tsc --noEmit` y `eslint` limpios.

**✅ VERIFICADO EN VIVO en Vercel con Claude in Chrome (2026-07-21) — módulo base cerrado de punta a punta:**
- Ramificación por host confirmada: `demo.ossgovernmentone.lat/` → **portal del tenant** ("Alcaldía Demo" +
  directorio de las 7 dependencias del árbol + menú Transparencia); `government-one.vercel.app/` → **landing de
  plataforma** ("Módulos de la plataforma"). Cero hardcode: el portal muestra los datos reales del tenant.
- **PQRSD pública (sin sesión):** un ciudadano radicó desde `/pqrsd` → `PQRSD-2026-000003` (Queja, "Alumbrado
  público dañado…", peticionario Pedro Ramírez). **Consulta pública** por número → estado "Recibida",
  radicada 2026-07-21 / vence 2026-08-11.
- **Cae en la Ventanilla Única del tenant:** al entrar a `/admin/vu`, la bandeja muestra la 000003 (canal WEB)
  asignada a **Responsable de Ventanilla Única (sin ocupante)** por el ruteo a servicio compartido
  (`resolverAsignacionVu(db, null)` → Atención al Ciudadano), estado RECIBIDA — junto a las 2 internas de
  Paso C. Sin duplicados. **El diferenciador cierra el círculo ciudadano→entidad.**

**🏁 MÓDULO BASE (Portal Institucional) COMPLETO:** A (estructura organizacional) · B (Gestión Documental) ·
C (Ventanilla Única) · D (portal público) — los cuatro construidos, con la fundación de dominio cableada
(capacidades por cargo + ruteo `quienEjerce`) y verificados en vivo en Vercel.

## Progreso — Bloque FINANCIERO/EJECUCIÓN (2026-07-21) — reconciliación de bitácora

> ⚠️ **Nota de proceso:** estos 4 módulos se construyeron y commitearon en turnos que se resumieron
> durante una interrupción, y **la bitácora no se actualizó en su momento** (la memoria del proyecto SÍ
> quedó al día — es la fuente de verdad de esta reconciliación). **Verificación: DOBLE — por scripts
> `verify-*.ts` contra la BD real del tenant demo (motor/lógica) Y por interacción real en el navegador
> (Claude in Chrome) en producción** (estándar del proyecto, [[verificar-en-vercel-no-local]]). Los detalles
> por módulo están en la memoria `punto-de-retoma`; aquí el resumen.

Siguen el orden del CLAUDE.md (Financiero → Presupuesto → Banco de proyectos → Contratación), portando los
patrones ya validados de `personeriabuga` al stack nuevo (Prisma 7, BD por tenant, server actions, gating por
capacidad `funcionarioPuede`, catálogos nacionales data-driven).

**1) Contabilidad (libro mayor, doble partida)** — commits `491a624`/`4a8116b`/`ffb2ff8`.
- Tenant schema: `PlanCuenta` (CGC jerárquico), `PeriodoContable`, `Tercero`, `Comprobante`+`Asiento`,
  `ComprobanteConsecutivo`. CGC = **catálogo nacional** (Res. CGN 533/2015 gobierno), corte operativo curado
  en `src/lib/contabilidad/cgc.ts`, sembrable por tenant (`aplicarPlanCuentas`, idempotente).
- Motor: registro de comprobante con validación de **partida doble en servidor** (∑débitos=∑créditos,
  cuentas hoja/activas, periodo ABIERTO). UI `/admin/contabilidad` (formulario de líneas dinámicas + cuadre
  en vivo, cuentas agrupadas por clase; balance de comprobación). Capacidad `contabilidad`
  (consultar/registrar/administrar/cerrar_periodo) en el catálogo. **Verificado por `verify-contabilidad.ts`.**

**2) Presupuesto (CCPET + cadena del gasto)** — commits `f5385fb`/`bb136dc`.
- **Catálogo CCPET territorial COMPLETO** (1.784 rubros oficiales MinHacienda) portado del parser validado en
  personeriabuga → `src/lib/presupuesto/ccpet-rubros.generated.ts` (nacional, sembrable). `Apropiacion` por
  vigencia; cadena **CDP → RP → Obligación → Pago** con validación de saldo disponible en cada eslabón; el
  **Pago genera un `Comprobante` EGRESO en Contabilidad** (D gasto / C banco) en la misma transacción, trazado
  por `fuenteModulo`/`fuenteRef` → cierra el círculo presupuestal↔contable. UI `/admin/presupuesto`.
  **Verificado por `verify-presupuesto.ts` + `verify-presupuesto-rp-pago.ts`** (CDP→RP→OB→PG→CE cuadrando).

**3) Banco de Proyectos (ejecución financiera vs física)** — commit `b8608e8`.
- `Proyecto` + `ProyectoHito` ponderado + histórico auditable `ProyectoHitoReporte`; `Cdp.proyectoId` enlaza la
  ejecución financiera al proyecto. `src/lib/proyectos/ejecucion.ts` calcula **financiera%** (pagado/valorTotal),
  **física%** (hitos ponderados) y la **BRECHA** — el diferenciador del producto (anticipo pagado sin obra =
  brecha alta/riesgo). UI `/admin/proyectos` (barras + semáforo). **Verificado por `verify-proyectos.ts`**
  ($20M/$40M, obra 0% → financiera 50%/física 0%/brecha +50pp/riesgo ALTO → tras entrega 100% → riesgo BAJO).

**4) Contratación (Ley 80/1150, gating real por persona)** — commits `cde3080`/`bb4f3b6`/`13e1be0`/`454f2d5`.
- `Contrato` + `ContratoVersion` (insert-only, versiona borradores y respuestas jurídicas). Máquina de estados
  `src/lib/contratacion/flujo.ts` (BORRADOR ⇄ EN_REVISION_JURIDICA ⇄ DEVUELTO_ESTRUCTURACION → PERFECCIONADO →
  SUSCRITO → EN_EJECUCION → SUSPENDIDO/TERMINADO/INCUMPLIDO/LIQUIDADO). **`puedeAvanzarContrato()` combina
  CAPACIDAD (vía cargo) Y ASIGNACIÓN por-persona** (`estructuradorId`/`abogadoAsignadoId`) — cierra el hueco de
  "cualquiera con la capacidad aprueba su propio contrato". `usuariosConCapacidad()` en `dominio/acceso.ts`;
  `ROLES_ADMIN_TENANT` exportado para el override de soporte del admin. UI `/admin/contratacion` (fila
  expandible con acciones válidas según estado + quién eres). Fixes: hidratación, formateador determinista de
  miles (no `toLocaleString` en cliente — [[hidratacion-tolocalestring-componentes-cliente]]), RP obligatorio
  antes de suscribir. **Verificado por `verify-contratacion.ts`** (7 casos de gating + recorrido con personas
  reales; saltarse un paso se rechaza siempre, incluso admin).

**Estado:** `tsc --noEmit` limpio; `main` sincronizado con origin (Vercel desplegó). Los 4 módulos quedaron
**verificados por script Y en el navegador en producción** (Claude in Chrome) — ver memoria `punto-de-retoma`
para los recorridos (ej.: Presupuesto mostró `CE-2026-000001` también en `/admin/contabilidad`; Contratación
recorrió BORRADOR→…→EN_EJECUCION en la UI real). Reconciliación de bitácora: **hecha**. Módulos en disco:
`contabilidad`, `presupuesto`, `proyectos`, `contratacion` (+ base A–D). **Siguiente** (de la memoria): evaluar
migrar Banco de Proyectos a Contrato→Actividad ahora que Contratación existe; luego Nómina / Tesorería /
Reportes de control (candidatos maduros a portar de personeriabuga).

## Progreso — Gobernanza de módulos: flujo de actores (2026-07-22)

El usuario aclaró el modelo de actores (y corrigió que veníamos probando todo como el SUPER_ADMIN, un
atajo): **superadmin** crea el tenant + su admin + **habilita los módulos contratados**; **admin del
tenant** crea dependencias + **asigna módulos a cada una**; la **dependencia de RRHH** crea funcionarios
con cargos y opera nómina + actos administrativos. Ni el superadmin ni el admin hacen la operación diaria.

**Paso 1 — gobernanza de módulos (backbone del flujo), 3 capas de acceso para no-admins:**
- `src/lib/modulos.ts` — catálogo NACIONAL de módulos (primitivo): base (siempre activo: `gestion_documental`,
  `ventanilla_unica`) vs contratables (contabilidad/presupuesto/tesorería/banco_proyectos/contratación/nómina),
  con `dependeDe` y `ruta`. `moduloDisponible(id, contratados)`.
- **Capa 1 — contratado por el tenant:** `Tenant.modulosContratados Json` (meta-DB, migración
  `add_modulos_gobernanza`) — lo habilita el superadmin. `contextoTenant` lo expone. UI en `/superadmin/tenants`
  (checkboxes de módulos contratables por tenant, `modulos-tenant.tsx` + `actualizarModulosTenantAction`).
- **Capa 2 — asignado a la dependencia:** `Dependencia.modulos Json` (BD tenant) — lo asigna el admin del
  tenant. UI en `/admin/estructura` (checkboxes por dependencia, `modulos-dependencia.tsx` +
  `asignarModulosDependenciaAction`), solo con los módulos disponibles del tenant.
- **Capa 3 — capacidad del cargo:** `tieneCapacidad` (ya existía).
- `dal-tenant.funcionarioPuede` reescrito: **capa 1 aplica a TODOS** (nadie usa un módulo no contratado, ni el
  admin); el admin del tenant omite capas 2 y 3; el resto exige las 3. `modulosVisibles()` para el nav.
  `admin/layout.tsx` ahora es **nav gobernado** (muestra solo los módulos visibles; Estructura solo para admin).
- `scripts/set-tenant-modulos.ts` (stopgap = lo que hace el superadmin). Demo contrató
  `[contabilidad, presupuesto, banco_proyectos, contratacion]` para no romperse (base siempre on).

**Verificación:** `tsc`/`eslint` limpios. Pendiente: pase en navegador (demo sigue operando + asignar módulos a
una dependencia). **Siguiente:** Paso 2 (RRHH/Gestión Humana: niveles de cargo + actos administrativos +
creación de funcionarios con credencial) y Paso 3 (Nómina). La verificación PLENA del gating de 3 capas para
no-admins llega con Paso 2 (funcionarios con login).

## Progreso — Gobernanza de módulos cerrada + aprovisionamiento completo (2026-07-22)

**Paso 1 cerrado de punta a punta:** verificada en navegador la última pieza (`/superadmin/tenants` con
checkboxes de módulos contratados por tenant, persistiendo real). Las 3 capas confirmadas visualmente:
superadmin habilita → admin tenant asigna a dependencia → capacidad del cargo.

**Hueco encontrado y cerrado — aprovisionamiento no dejaba el tenant usable (commit `a055e6f`):** el usuario
preguntó si un tenant nuevo llega con Portal+GD+VU habilitados por defecto; al verificar apareció que
`provisionTenant()` NO sembraba estructura organizacional ni creaba ningún funcionario — un tenant nuevo
quedaba `ACTIVO` sin que nadie pudiera iniciar sesión. Fix: tras aplicar el schema, `provisionTenant()` ahora
siembra `aplicarPlantilla(tipoEntidad)` (si existe plantilla para ese tipo) y crea el admin inicial con
`passwordHash: null` (se fija aparte, mismo patrón de credenciales de siempre). Formulario del superadmin
pide nombre/apellido/correo del admin. **Verificado con un tenant real** (Personería Verificación): Neon
creado, 3 dependencias/4 cargos sembrados, admin sin contraseña, `modulosContratados=[]` por defecto —
luego borrado. Hallazgo de infra en el camino: `NEON_API_KEY` de Vercel producción estaba desactualizada
(el usuario la actualizó él mismo, Claude nunca maneja esa clase de secretos).

**Apex `ossgovernmentone.lat` movido a government-one** (a pedido explícito del usuario): mismo patrón que
el wildcard (`DELETE`/`POST` project-domains vía API de Vercel). Cero cambios de código —
`resolveTenantByHost` ya trataba cualquier host sin tenant registrado como plataforma, así que el apex
"simplemente funcionó" al apuntar al proyecto nuevo. Verificado: apex → landing nueva, `apex/login` → login
del superadmin (antes solo vivía en `government-one.vercel.app`).

## Progreso — Paso 2: RRHH/Talento Humano + catálogo DAFP de empleos (2026-07-23, commits `44c4285`+`1706a13`)

El usuario corrigió que veníamos probando todo como el admin del tenant: **ni superadmin ni admin hacen la
operación diaria** — la dependencia real de Talento Humano crea funcionarios y registra sus actos
administrativos. Antes, `/admin/estructura` mezclaba TODO (dependencias/cargos/funcionarios/vínculos)
gateado solo por rol ADMIN.

**Módulo nuevo `gestion_humana` (base, siempre activo, ruta `/admin/rrhh`):**
- Capacidades `gestionar_funcionarios`/`actos_administrativos`/`consultar`. `nomina` (aún sin construir en
  ese momento) pasó a `dependeDe: ["gestion_humana","contabilidad"]`.
- `/admin/rrhh`: crear funcionario (rol fijo USER — RRHH no puede otorgarse ADMIN a sí mismo), registrar
  acto administrativo (TITULAR/ENCARGADO/PROVISIONAL con `actoAdmin` **obligatorio**, antes era opcional),
  registrar ausencias — todo gateado por capacidad `funcionarioPuede`, no por rol.
- `/admin/estructura` se recortó: ya no crea funcionarios ni vínculos, solo estructura + tabla de solo
  lectura.

**Catálogo DAFP de empleos (corrección de fondo tras ejemplo real del usuario):** el `nivel` genérico de
`Cargo` (5 categorías) no distinguía nada real — el usuario dio el ejemplo de Planeación (técnico de
estratificación, profesional universitario de seguimiento al PDM, profesional especializado líder del
banco de proyectos, secretario). Mismo patrón que CGC/CCPET (catálogo nacional sembrado por tenant,
editable):
- `EmpleoDafp` (código+denominación+nivel, Decreto 785/2005, corte curado ~22 denominaciones) —
  `src/lib/dominio/empleos-dafp.ts` + `sembrarEmpleosDafp()`, sembrado ANTES de `aplicarPlantilla`.
- `Cargo.empleoId` (nivel ahora DERIVADO del empleo), `Cargo.funciones` (responsabilidad específica del
  cargo), `Cargo.jefeInmediatoId` (autorrelación — supervisión real dentro de la dependencia, distinta de
  `esJefatura` de toda la dependencia). NO se hardcodearon cadenas de jefe inmediato en las plantillas (es
  realidad de cada tenant); sí se enriqueció Planeación con los 4 roles reales del ejemplo (genérico, sin
  nombres).

**Bug encontrado y corregido:** `rrhh/page.tsx` comparaba vigencia de `VinculacionCargo` contra un "ahora"
truncado a medianoche — cualquier acto registrado el MISMO día quedaba excluido de "vigente" hasta el día
siguiente. Fix: comparar contra la hora exacta; las ausencias (rangos de día calendario) sí truncan.

**Verificado en vivo:** primera vez en todo el proyecto con un funcionario NO-admin real (Carlos Ramírez,
vinculado a Profesional de Talento Humano) — su nav mostró solo "Talento Humano", operó RRHH sin problema,
y `/admin/contratacion` lo rechazó pese a que el tenant sí tenía ese módulo contratado (capa 2 filtrando
correctamente).

## Progreso — Ventanilla Única: derivar + clasificación por IA (2026-07-23, commits `5ffd389`+`b95cc19`)

**"Derivar a otra dependencia" (commit `5ffd389`):** el ciudadano nunca elige dependencia en el portal
público, así que una PQRSD sin pistas cae siempre en el fallback de servicio compartido (Atención al
Ciudadano) sin importar el contenido, y no había forma de corregir ese ruteo después. Nueva acción
`derivarPqrsdAction` reutiliza `resolverAsignacionVu` contra la dependencia elegida por un humano —
gateada por `ventanilla_unica:asignar`, capacidad que existía en el catálogo desde la fundación pero
nunca se había cableado a nada.

**Clasificación de PQRSD por IA, multi-proveedor (commits `0e8864f`→`b95cc19`):** el usuario pidió que la
IA leyera el CUERPO de la petición y asignara directo al funcionario correcto según sus `funciones`
(ejemplos reales: línea de paramento → técnico de ordenamiento territorial; subsidio de adulto mayor →
técnico de Bienestar Social) — sin que el ciudadano mencione dependencia/cargo. Diseño:
- `TenantSecretos` (`Tenant.secretosEncriptados`, campo que ya existía pero nunca se había cableado) —
  regla de oro: ninguna clave de IA se comparte entre tenants.
- **Multi-proveedor** (corrección tras el primer intento con Anthropic — el usuario configuró Groq):
  `src/lib/ia/proveedores/openai-compatible.ts` (un solo adaptador para OpenAI/Groq/Zhipu, comparten
  formato), `anthropic.ts`, `gemini.ts` aparte. `clasificar-pqrsd.ts` es el dispatcher.
- `resolverAsignacionVu` intenta IA SOLO si no hay dependencia dada, contra cargos con
  `ventanilla_unica:responder` + `funciones` descritas; sin clave configurada o cualquier falla → degrada
  EXACTAMENTE al comportamiento de siempre — nunca bloquea un radicado real.
- Superadmin: selector de proveedor + clave, write-only.

**Verificado en vivo con la clave real de Groq del usuario:** creé los funcionarios Héctor Fabio Cruz
(Planeación) y Diego López (Bienestar Social) vía RRHH; radiqué por el portal público (sin sesión, sin
dependencia) las dos peticiones exactas del ejemplo del usuario — ambas quedaron `ASIGNADA` directo a la
persona correcta.

## Progreso — Paso 3: Nómina COMPLETA (2026-07-23, commits `734ab87`+`1da04b1`+`d6e5eba`)

**Primer cut (commits `734ab87`+`1da04b1`):** investigué `personeriabuga` (Fase 11/12/15, módulo
`nomina_publica`) vía subagente antes de portar — hallazgo clave: allá `NomEmpleado` era un modelo AISLADO
con cargo/dependencia en texto libre, sin relación con la estructura real. En `government-one` NO se
repitió: el "empleado de nómina" ES el `Usuario` con `VinculacionCargo` vigente que RRHH ya gestiona —
nómina solo LEE el salario que RRHH fija al posesionar (`VinculacionCargo.salarioBasico`, campo nuevo).
- `src/lib/nomina/motor.ts` (función pura): devengados→IBC→deducciones→aportes patronales/prestaciones→neto,
  sin heurísticas por nombre de concepto.
- 12 conceptos curados (sueldo, prima mensualizada, auxilio transporte, salud/pensión empleado y patronal,
  ARL, caja, ICBF, SENA, cesantías). `cgc.ts` extendido 69→80 cuentas.
- `/admin/nomina`: sembrar conceptos, crear periodo, liquidar, pagar (comprobante EGRESO agregado en
  Contabilidad, mismo patrón que Presupuesto→Pago→Comprobante). Capacidad `nomina:[consultar,liquidar,pagar]`.
- Bug encontrado: extender `cgc.ts` en código no alcanza — hay que re-correr `aplicarPlanCuentas` contra
  tenants ya sembrados (mismo patrón recurrente: editar un catálogo en código nunca actualiza tenants ya
  sembrados automáticamente).

**Segundo incremento, MISMA sesión (commit `d6e5eba`) — corrección de fondo del usuario:** *"hagamos las
cosas completas en lugar de andar pensando en dejar algo a medias y sapotear otra cosa"* — rechazó
explícitamente el patrón de "primer corte + resto para después" que había funcionado para Contabilidad/
Presupuesto. Se completó TODO en la misma pasada:
- **Retención en la fuente REAL** (no placeholder=0): tabla progresiva Art. 383 ET (7 tramos en UVT, ley
  estable) + `NominaParametro` (UVT editable por tenant, sembrado con el valor 2025 conocido y su fuente).
  Base gravable = IBC − aportes obligatorios ya deducidos − 25% renta exenta (tope 240 UVT). Verificado por
  script contra 8 tramos de UVT, coincide al peso con el cálculo manual.
- **Novedades afectando el neto:** las `Ausencia` de RRHH (licencia/incapacidad) ahora se leen al liquidar
  — licencia + incapacidad desde el día 3 prorratean el devengado; incapacidad genera el auxilio del
  66.67% (Ley 100/1993 Art. 227); vacaciones/comisión no reducen nada (remuneradas).
- **PILA:** generador con campos núcleo de un registro tipo 2 UGPP — alcance declarado honestamente (no
  reclama compatibilidad byte-exacta con la especificación completa sin poder verificarla contra la vigente).
- **Pago de pasivos a terceros** (EPS/AFP/ARL/caja/DIAN): saldo real por cuenta (causado por nómina − ya
  pagado), comprobante propio.
- **Certificado de retenciones** (Art. 378 ET) con la retención YA calculada de verdad.
- RRHH: `Usuario.documento/tipoDocumento` + tarjeta "Datos de seguridad social" (EPS/AFP/ARL/caja como
  texto libre a propósito — un catálogo con códigos UGPP inventados sería peor que texto libre si algún
  dígito estuviera mal). `Tenant.nit` en meta-DB (UI superadmin) — lo exige PILA.

**Verificado en vivo:** comprobante de pago de periodo cuadrado ($11.454.320 débito=crédito); PILA generada
(3 afiliados, exige NIT+documento); pago real a "Nueva EPS" ($296.000) redujo el saldo pendiente a $0;
certificado de Héctor Fabio Cruz con sus datos reales.

**Módulo Nómina: COMPLETO.** Nueva memoria de feedback (`feedback-completar-no-trocear`) que rige el resto
del rebuild: terminar cada módulo por completo en la misma pasada, no dejar piezas para "un segundo
incremento" salvo simplificaciones legales estándar declaradas honestamente (no piezas sin construir).

**Siguiente:** Tesorería (único módulo del catálogo `MODULOS_CONTRATABLES` sin página aún) — y revisar qué
más le falta a un módulo de Hacienda Pública completo (Contabilidad+Presupuesto+Tesorería+Nómina) antes de
darlo por cerrado.

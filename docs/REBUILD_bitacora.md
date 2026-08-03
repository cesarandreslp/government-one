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
- `REFERENCIA_interoperabilidad_estatal.md` — nota (no plan activo) sobre alineación con X-Road/AND
  para cuando algún tenant requiera trámites reales contra otras entidades del Estado.

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

## Progreso — Paso 4: Tesorería COMPLETA (2026-07-24, commit `fa324de`)

**Decisión de diseño (investigada antes de codear):** un subagente revisó cómo `personeriabuga` implementó
Tesorería y encontró el hueco que este rebuild debía cerrar: allá "movimiento de tesorería" es una tabla
PROPIA con `comprobanteId`/`pagoPresupId` opcionales que en la práctica nunca se conectan — el saldo de
tesorería vive separado del libro mayor y puede desincronizarse. En `government-one` el "movimiento de
tesorería" **NO es una tabla — es una vista derivada de `Asiento`** (`src/lib/tesoreria/movimientos.ts`):
cualquier pago que Presupuesto/Nómina/Contabilidad ya postearon sobre una cuenta bancaria (`cuentaContableId`)
aparece automático, sin captura duplicada. Lo único nuevo que Tesorería aporta es capturar los movimientos
que NO nacen en otro módulo (recaudo directo, rendimientos financieros, traslados entre cuentas propias) —
y esos **también postean un `Comprobante` real** (`fuenteModulo: "tesoreria"`), nunca un movimiento suelto.

**Modelo (tenant schema, aditivo):** `TesoCuenta` (cuenta bancaria real, enlazada 1:1 a una hoja del plan de
cuentas 11xx), `TesoExtracto`+`TesoExtractoLinea` (extracto bancario cargado, una línea por movimiento),
`TesoConciliacion`+`TesoConciliacionLinea` (la conciliación apunta DIRECTO al `Asiento.id` real — nunca
duplica su valor/fecha/descripción; `@@unique([asientoId])` impide conciliar dos veces el mismo movimiento).
`provision-schema.sql` regenerado (4 tablas nuevas); delta aplicado a todos los tenants ACTIVO con
`migrate-tenants-diff.ts`. Capacidad `tesoreria:[consultar,administrar,conciliar]`.

**UI:** `/admin/tesoreria` (KPIs, alta de cuenta, "Registrar movimiento" → transacción con `Comprobante`+2
`Asiento` según INGRESO/EGRESO, carga de extracto por texto CSV-like) + `/admin/tesoreria/conciliar` (panel
1:1 y N:1: radio de movimientos pendientes del libro mayor + checkboxes de líneas de extracto pendientes,
tolerancia $1, con reversa).

**Verificado EN VIVO en `demo.ossgovernmentone.lat`** (delta aplicado a demo + módulo habilitado vía
`set-tenant-modulos.ts`): crear la cuenta "Cuenta corriente Bancolombia" (enlazada a 111005) hizo aparecer
**automáticamente 3 movimientos reales preexistentes** (pago de nómina, pago de pasivo a EPS, un recaudo
manual anterior) sin ninguna captura nueva — prueba directa de que "cero duplicación" funciona. Se registró
un movimiento nuevo (comisión bancaria, EGRESO) → posteó `CE-2026-000005` real en Contabilidad. Se cargó un
extracto de 5 líneas y se conciliaron: un caso **1:1** (recaudo $250.000) y un caso **N:1** (neto de nómina
$8.024.420 contra 2 líneas de transferencia que suman exacto) — y se **revirtió** la conciliación 1:1,
confirmando que el movimiento y la línea vuelven a "pendiente" sin tocar la N:1.

**Módulo Tesorería: COMPLETO.**

## Auditoría — qué le falta a Hacienda Pública para estar completa (2026-07-24)

Con Contabilidad+Presupuesto+Tesorería+Nómina construidos y verificados, se comparó contra (a) un documento
de investigación del usuario sobre la estructura real de Secretarías de Hacienda de 7 entidades territoriales
colombianas (`docs/conformacion hacienda.pdf`) y (b) el estado real del código (grep, no memoria). Hallazgos:

**Ya cubierto:** Presupuesto (macroproceso 1: elaboración/CDP/RP/obligación/pago), Contabilidad (macroproceso
4: libro mayor con partida doble), Tesorería (macroproceso 3: pagos/recaudos/manejo bancario/conciliaciones).

**Huecos reales identificados (verificados contra el código, no supuestos):**
1. **Rentas/Ingresos tributarios** — "presencia muy alta" en las 7 entidades comparadas (predial, ICA,
   sobretasa gasolina, registro, degüello). El CCPET YA tiene los 512 rubros de tipo INGRESO sembrados, pero
   **no existe ningún flujo de liquidación/recaudo/cartera para ellos** — Presupuesto solo modela la cadena
   del GASTO (CDP→RP→Obligación→Pago); el lado del ingreso no tiene equivalente ("Reconocimiento"+recaudo).
   Es el hueco más grande.
2. **Cobro Coactivo / Cartera** — "presencia alta". Sin gestión de cartera morosa, mandamientos de pago,
   embargos. Depende de que exista primero el módulo de Rentas (no se puede cobrar cartera de un impuesto
   que el sistema no liquida).
3. **PAC (Programa Anual Mensualizado de Caja) por fuente de financiación** — Presupuesto no modela
   "fuente de financiación" (SGP, recursos propios, regalías, etc.) en ninguna parte del schema, y no hay
   mensualización de caja. Afecta a Presupuesto (elaboración) y Tesorería (programación) por igual.
4. **Cierre de vigencia / cierre de periodo contable** — la capacidad `contabilidad:cerrar_periodo` existe en
   el catálogo desde la fundación pero **nunca se implementó**: no hay ninguna acción que pase un
   `PeriodoContable` a `CERRADO` (el código solo LEE ese estado para bloquear comprobantes). Cierre de
   vigencia presupuestal (reservas presupuestales, constitución de cuentas por pagar) tampoco existe.
5. **Estados financieros / reportes formales** — el libro mayor (Comprobante/Asiento) existe y cuadra, pero
   no hay ningún reporte derivado: Balance General, Estado de Resultados, ni export a formato CHIP/CGN
   (obligación legal real de reporte a la Contaduría General de la Nación).
6. **Boletín diario de caja** — reporte rutinario de Tesorería (saldo inicial/movimientos del día/saldo
   final) que hoy no existe como vista propia (los datos SÍ están, ya que todo se deriva del libro mayor —
   sería una consulta nueva, no un modelo nuevo).
7. **Crédito Público** (deuda/empréstitos) y **Fondo Territorial de Pensiones** — "presencia alta"/"media",
   pero mucho más relevantes en gobernaciones/distritos grandes que en alcaldías/personerías pequeñas; encajan
   en el patrón data-driven del proyecto (módulo opcional, plantilla por tipo de entidad) si se decide
   construirlos.
8. **Planeación Financiera / Estudios Fiscales** (macroproceso 6 del comparativo) — Marco Fiscal de Mediano
   Plazo, proyecciones fiscales, indicadores de sostenibilidad. Es la capa analítica que consume el histórico
   de los otros módulos (ya real y verificado); no requiere captura nueva, solo agregación/reporte — el hueco
   más barato de cerrar de toda la lista, pero solo tiene sentido una vez haya varias vigencias de datos reales.

**No se construyó nada de esto todavía — queda para que el usuario decida el orden/alcance.**

## Progreso — Cargos diferenciados en Hacienda (2026-07-24, commit `710c056`)

El usuario corrigió, sin que se le preguntara: *"no todos los funcionarios de hacienda tienen
acceso a todas las funcionalidades, algunos lo tendrán a presupuesto, otros a recaudo, otros a
coactivo, algunos a dos módulos, otros a 3, etc"*. Verificado en el código: la plantilla de
Secretaría de Hacienda (`HAC`) solo tenía 2 cargos desde la fundación (Secretario + Profesional de
Presupuesto) — Contabilidad, Tesorería y Rentas, aunque ya construidos y funcionando, no tenían
ningún cargo real que los operara (solo el bypass de ADMIN/SUPER_ADMIN podía usarlos).

Se agregaron 3 cargos nuevos a la plantilla ALCALDIA, cada uno con un módulo propio (Profesional
de Contabilidad, Profesional de Presupuesto, Profesional de Rentas); el Secretario quedó con
consulta transversal a las 4 sub-áreas + aprobar presupuesto (supervisión, no operación); el
Tesorero es la única excepción con 2 módulos (tesorería completa + `rentas:recaudar` — separación
real entre quien liquida el impuesto y quien lo cobra). Re-sembrado contra el tenant demo
(idempotente). Nueva memoria de feedback (`feedback-cargos-diferenciados-por-submodulo`): al
agregar un módulo nuevo a una dependencia que YA existe en una plantilla, hay que actualizar
también los cargos — el código soportar el gating no basta.

## Progreso — Cobro Coactivo (2026-07-24, commit `48487ac`)

Segundo hueco de la auditoría cerrado (dependía de Rentas, ya lista). Agrupa la cartera VENCIDA de
un contribuyente por tipo de impuesto en un expediente (`CoactivoProceso`, restringido a un solo
`RentaTipoImpuesto` por proceso para que la contabilización sea determinística). Historial
insert-only de actuaciones (`CoactivoActuacion`, mismo patrón que `ProyectoHitoReporte`) con
transición de estado automática (PERSUASIVO→MANDAMIENTO_PAGO→EMBARGO). El acuerdo de pago en
cuotas (`CoactivoAcuerdoPago`+`CoactivoCuota`) es la única vía de pago parcial — el motor
(`src/lib/coactivo/motor.ts::calcularCuotas`) reparte el saldo entre N cuotas, con la ÚLTIMA
absorbiendo el residuo de redondeo para que la suma sea exacta. Cada cuota (o el pago total antes
de entrar a un acuerdo) postea un Comprobante INGRESO real sobre las mismas cuentas
410502/410510 de Rentas — cero duplicación, mismo diseño ya probado en Tesorería. Al pagarse la
última cuota, el proceso pasa a TERMINADO automáticamente y las liquidaciones agrupadas a PAGADA
en bloque (nuevo estado `EN_COBRO_COACTIVO` en `RentaEstadoLiquidacion` mientras tanto).

**Aplica de inmediato la lección de cargos diferenciados:** nuevo cargo "Profesional de Cobro
Coactivo" (`cobro_coactivo:[consultar,gestionar]`) separado del Tesorero (`cobro_coactivo:
[recaudar]`) — quien tramita el mandamiento/embargo no es quien recibe el pago.

**Simplificación legal declarada honestamente:** no calcula interés de mora (Art. 634-635 ET)
sobre la deuda, y el historial de actuaciones es un registro administrativo del trámite, no un
sistema de notificación judicial con efectos procesales (edictos, términos de ejecutoria) — eso
excede lo que este corte puede garantizar sin asesoría jurídica específica.

**Verificado EN VIVO en `demo.ossgovernmentone.lat`:** liquidé una ICA vencida ($350.000) del
contribuyente de prueba, abrí `COA-2026-000001` (deuda inicial $350.000 exacto), registré
mandamiento de pago (estado avanzó correctamente), creé un acuerdo de 3 cuotas — **$116.666 +
$116.666 + $116.668 = $350.000 exacto** (redondeo absorbido por la última) — pagué las 3 cuotas
una por una: el proceso terminó automáticamente al pagar la última, saldo pendiente a $0,
`RentaLiquidacion` pasó a PAGADA, **3 comprobantes `CI-2026-000004/5/6` cuadrados en Contabilidad**
($116.668/$116.666/$116.666 débito=crédito cada uno), y **los 3 aparecieron automáticos en
Tesorería** con `origen: cobro_coactivo`, sin ninguna captura adicional.

**Módulo Cobro Coactivo: COMPLETO.** Quedan 6 huecos de la auditoría original (PAC por fuente,
cierre de vigencia, estados financieros CHIP-CGN, boletín de caja, crédito público/pensiones,
planeación financiera/MFMP) — decisión del usuario cuándo seguir.

El usuario, tras releer su propio comparativo (`docs/conformacion hacienda.pdf`, cruce de 7
Secretarías de Hacienda reales), eligió **Rentas/Ingresos tributarios** como el siguiente hueco a
cerrar — confirmado por `AskUserQuestion`, el hueco #1 de la lista.

## Progreso — Rentas: impuesto predial + ICA (2026-07-24, commit `eb214c6`)

Cierra el hueco más grande de la auditoría: Presupuesto solo modelaba el lado del GASTO
(CDP→RP→Obligación→Pago); el INGRESO no tenía equivalente pese a que el CCPET ya tiene 512 rubros
de tipo INGRESO sembrados.

**Diseño (evita duplicar primitivas ya existentes):** el contribuyente es SIEMPRE un `Tercero`
(mismo modelo que ya usan Contabilidad/Presupuesto/Contratación) — Rentas no crea su propio
registro de personas/NIT, solo permite seleccionar uno existente (igual patrón que Contratación
selecciona un `Tercero` para el contratista). Las tarifas (Acuerdo Municipal, cambian cada
vigencia y varían por entidad) son **dato del tenant editable**, nunca un catálogo nacional
quemado — a diferencia del CGC/CCPET/DAFP que sí lo son, porque una tarifa tributaria territorial
no es una norma nacional fija.

**Modelo (tenant schema, aditivo):** `RentaPredio` (predial: número predial, `contribuyenteId`→
Tercero, destino económico, avalúo catastral), `RentaActividadEconomica`+`RentaEstablecimiento`
(ICA), `RentaTarifaPredial` (rango de avalúo×destino×vigencia), `RentaLiquidacion` (tipo
PREDIAL|ICA, `predioId`/`establecimientoId` mutuamente excluyentes, `rubroIngresoId` OPCIONAL a
`RubroPresupuestal` tipo INGRESO — reutiliza `Apropiacion` ya existente para comparar recaudado
vs. aforado sin crear un modelo nuevo), `RentaPago` (pago total, 1:1 con la liquidación, mismo
criterio que Presupuesto→Pago y Nómina→pagar). `provision-schema.sql` regenerado (7 tablas
nuevas); delta aplicado a tenants + módulo `rentas` habilitado en demo.

**Motor puro** (`src/lib/rentas/motor.ts`): `liquidarPredial` busca la tarifa del rango de
avalúo+destino+vigencia y aplica `avalúo × tarifa‰`; `liquidarIca` aplica `ingresos brutos ×
tarifa‰` de la actividad del establecimiento. Simplificación legal declarada honestamente (no
placeholder falso): NO aplica el tope de incremento anual del predial (Ley 44/1990 Art. 6) ni
descuentos por pronto pago — ambos son ajustes sobre este valor base correctamente calculado,
quedan para un siguiente incremento.

**Pago → Contabilidad:** cero cuentas nuevas en el CGC — `410502` (predial) y `410510` (ICA) ya
existían del corte original. El pago postea un Comprobante INGRESO real (D banco/caja / C
ingreso), `fuenteModulo: "rentas"` — aparece automático en Tesorería, mismo diseño de "cero
duplicación" ya verificado en el módulo de Tesorería.

**Verificado EN VIVO en `demo.ossgovernmentone.lat`:** tarifa predial 2026 RESIDENCIAL 6‰
sin tope → predio con avalúo $120.000.000 liquidó **exacto $720.000**; actividad ICA "Actividades
de desarrollo de software" 7‰ → establecimiento con $80.000.000 de ingresos brutos liquidó
**exacto $560.000**; cartera pendiente mostró $1.280.000 (suma de ambas), coincidiendo al peso.
Pagué la liquidación predial → `CI-2026-000003` posteado en Contabilidad, **$720.000 débito =
$720.000 crédito**, cartera bajó a $560.000 (solo ICA pendiente), y el mismo movimiento apareció
**automáticamente** en Tesorería (`CI-2026-000003 · rentas · Recaudo predial PRE-2026-000001 ·
$720.000`) sin ninguna captura adicional — la misma prueba de "cero duplicación" que ya se hizo
con Tesorería, ahora confirmada también desde el lado de un módulo que APORTA movimientos nuevos
al sistema (no solo los consume).

**Módulo Rentas: COMPLETO** (predial + ICA — liquidación, cartera, recaudo, posteo contable,
enlace opcional a Presupuesto). Quedan 7 huecos más de la auditoría original sin construir
(cobro coactivo, PAC, cierre de vigencia, estados financieros CHIP-CGN, boletín de caja, crédito
público/fondo de pensiones, planeación financiera/MFMP) — decisión del usuario cuándo seguir.

## Progreso — Talento Humano: separar Nómina de Administración de Personal (2026-07-24, commit `a029227`)

El usuario subió un segundo comparativo (`docs/Estructura Secretaría takento humano.pdf`, misma
metodología que el de Hacienda: estructura real de Secretarías de Talento Humano de varias
alcaldías/gobernaciones colombianas) y pidió aplicar **la misma lógica de cargos diferenciados**
a Talento Humano. Verificado en el código: la oficina `TH` tenía 2 cargos (Jefe + Profesional de
Talento Humano) con **grants IDÉNTICOS** — ambos solo `gestion_humana`, y **ninguno** tenía la
capacidad `nomina`, pese a que Nómina es un módulo completo y funcionando desde hace días. Mismo
patrón exacto que el hallazgo de Hacienda, esta vez detectado por el usuario en vez de por mí.

El comparativo confirma que "Dirección de Nómina" es una dependencia real separada de
"Administración de Personal" en toda entidad territorial, descrita como "uno de los procesos más
críticos" — refuerza la separación de funciones ya aplicada en Rentas/Tesorería/Coactivo (quien
liquida no es quien paga/gestiona).

**Cambio (ALCALDIA y PERSONERIA):** nuevo cargo **Profesional de Nómina**
(`nomina:[consultar,liquidar,pagar]`), separado de **Profesional de Talento Humano**
(`gestion_humana` solo — vinculación y actos administrativos). El **Jefe de Talento Humano** gana
`nomina:[consultar]` para supervisión sin operar el detalle (mismo criterio que el Secretario de
Hacienda: consulta transversal, no ejecución). Re-sembrado contra el tenant demo — verificado por
script (patrón `verificacion-por-script-vs-login`, la sesión del navegador había expirado y no se
reingresó): los 3 cargos quedaron con los grants exactos diseñados.

**Nota:** de los 13 macroprocesos del comparativo (Seguridad Social, SST, Bienestar Social,
Capacitación, Evaluación del Desempeño, Relaciones Laborales, Situaciones Administrativas,
Gestión Disciplinaria, Historia Laboral, Planeación del TH, Sistemas de Información), solo
`gestion_humana` (Administración de Personal + Situaciones Administrativas) y `nomina` existen
hoy como módulos reales en el código — el resto son huecos funcionales de Talento Humano, no de
gobernanza de cargos, y quedan fuera de este cambio (no se inventaron capacidades para
funcionalidad que no existe).

## Auditoría — qué le falta a Talento Humano frente al comparativo (2026-07-24)

Mismo ejercicio que la auditoría de Hacienda Pública, esta vez sobre `docs/Estructura Secretaría
takento humano.pdf` (13 macroprocesos reales de Secretarías de Talento Humano colombianas)
cruzado contra el código (`src/app/admin/rrhh/actions.ts` — solo 5 acciones existen: crear
funcionario, registrar acto, actualizar salario, actualizar datos SS, registrar ausencia).

**Cubierto:** Administración de Personal (vinculación/actos administrativos), Situaciones
Administrativas (vacaciones/licencia/comisión/incapacidad vía `Ausencia`), Nómina completa,
Seguridad Social solo como *códigos* de afiliación (EPS/AFP/ARL/caja) + PILA + pago de pasivos.

**No construido (9 de 13 macroprocesos):** Planeación del TH, SST/SG-SST, Bienestar Social,
Capacitación (PIC), Evaluación del Desempeño, Relaciones Laborales, Gestión Disciplinaria,
Historia Laboral como expediente digital propio (hoy los datos existen dispersos en
Usuario/VinculacionCargo/Ausencia, sin certificados generables ni vista unificada), y ninguna
integración externa real (SIGEP II, SIMO, DIAN, UGPP — solo se genera el archivo PILA).

**Nada construido todavía — el usuario decide el orden.** Candidatos con más peso real:
1. **Historia Laboral + certificados laborales** — el más barato de cerrar: los datos YA existen
   (Usuario+VinculacionCargo+Ausencia), falta una vista unificada por funcionario + generador de
   certificado (mismo patrón que el certificado de retenciones de Nómina, ya construido).
2. **Evaluación del Desempeño** — obligatoria por ley para empleados de carrera administrativa
   (EDL), se apoya directo en `VinculacionCargo` ya existente.
3. **SG-SST** — obligatorio (Decreto 1072/2015) pero el más grande de construir (matriz de
   riesgos, COPASST, exámenes médicos, accidentalidad).

El usuario eligió la opción 1 (`AskUserQuestion`).

## Progreso — Certificación Laboral (2026-07-24, commit `762f40c`)

Cierra el hueco más barato de la auditoría de TH: **cero modelos nuevos** — la "historia laboral"
ya vivía completa en `Usuario`+`VinculacionCargo` (RRHH la captura desde el Paso 2); solo faltaba
la vista de reporte. `/admin/rrhh/certificado?usuarioId=X` (mismo patrón que el certificado de
retenciones de Nómina): deriva el **cargo actual** con la misma jerarquía de `quienEjerce`
(titular > encargado > provisional), el **estado** ACTIVO/RETIRADO (¿hay vinculación vigente
hoy?), y el **tiempo de servicio** continuo desde la primera vinculación registrada — declarado
honestamente que no descuenta interrupciones que no estén registradas como acto administrativo.
Enlace "Certificado" agregado a cada fila de la tabla de funcionarios en `/admin/rrhh`.

**Contraseñas de prueba:** primera vez que se aplica [[feedback-passwords-test-fase-construccion]]
(acuerdo explícito del usuario) — fijé yo mismo una contraseña de prueba para Carlos Ramirez
(funcionario de RRHH ya existente en el tenant demo) por script, sin pedirle al usuario que la
tipeara.

**✅ VERIFICADO EN VIVO en `demo.ossgovernmentone.lat` como funcionario NO-admin real** (Carlos
Ramirez, Profesional de Talento Humano — primera vez que se loguea un funcionario de este cargo,
no solo el admin): el certificado de Héctor Fabio Cruz renderizó con datos 100% reales — CC
10245678, "Técnico Operativo — Ordenamiento Físico y Territorial" (Secretaría de Planeación),
Titular según "Decreto 112 de 2026", $2.200.000, estado ACTIVO. Los 6 funcionarios con actos
registrados muestran el enlace "Certificado" en la tabla.

**Módulo RRHH: 1 de 9 huecos de la auditoría de Talento Humano cerrado.** Quedan 8 (Planeación
del TH, SST, Bienestar Social, Capacitación, Evaluación del Desempeño, Relaciones Laborales,
Gestión Disciplinaria, integraciones externas) — decisión del usuario cuándo seguir.

El usuario pidió explícitamente **"continuemos, terminemos talento humano"** — se construyeron
los 8 huecos restantes en la misma sesión.

## Progreso — Talento Humano COMPLETO: 6 módulos + Planeación (2026-07-24, commit `d90a117`)

**Schema en un solo lote** (12 tablas nuevas, aditivo, sin conflicto entre módulos): `EvaluacionDesempeno`;
`SstRiesgoCargo`+`SstIncidente`+`SstExamenMedico`; `Capacitacion`+`CapacitacionInscripcion`;
`ActividadBienestar`+`BienestarParticipante`; `PermisoSindical`;
`ProcesoDisciplinario`+`DisciplinarioActuacion`+`DisciplinarioConsecutivo`.

**Evaluación del Desempeño (EDL):** acuerdo de gestión (compromisos) + calificación 0-100 con
nivel derivado (≥90 Sobresaliente / ≥75 Destacado / ≥60 Satisfactorio / <60 No satisfactorio). El
evaluador se DERIVA de `Cargo.jefeInmediatoId` + `quienEjerce` — la misma fundación de dominio que
ya rutea Ventanilla Única — nunca se elige a mano; si el cargo no tiene jefe inmediato definido, lo
dice honestamente en vez de forzar un evaluador falso.

**SG-SST:** matriz de riesgos por cargo, accidentalidad/incidentes, exámenes médicos
ocupacionales. Simplificación legal declarada: registro interno, NO genera FURAT/FUREL oficial ni
notifica a la ARL.

**Capacitación (PIC), Bienestar Social, Relaciones Laborales:** cursos/inscripciones/asistencia;
actividades/participantes; permisos sindicales — los tres módulos más simples, sin peculiaridades.

**Gestión Disciplinaria:** historial de actuaciones insert-only (mismo patrón que
`CoactivoActuacion`), con transición de estado (indagación→investigación→descargos→fallo→archivado).
**Asignada a JURÍDICA, no a Talento Humano** — el propio comparativo del usuario señala que la
gestión disciplinaria suele depender de Jurídica. Simplificación legal declarada: trámite
administrativo interno, no un sistema de notificación judicial con efectos procesales garantizados
(sin edictos ni términos de ejecutoria).

**Planeación del Talento Humano — cero modelos nuevos:** Plan Anual de Vacantes y dimensionamiento
de planta por nivel/dependencia, 100% derivado de `Cargo`+`VinculacionCargo` ya existentes — mismo
patrón barato que Historia Laboral.

**Cargos actualizados** (ALCALDIA y PERSONERIA, aplicando de inmediato
[[feedback-cargos-diferenciados-por-submodulo]]): Profesional de Talento Humano gana
evaluación/SST/capacitación/bienestar/relaciones laborales (oficina pequeña, un solo profesional
coordina los procesos misionales — la nómina queda separada en su propio cargo); Jefe de TH gana
consulta transversal a los 5; Jefe de Oficina Jurídica (Personero Delegado en Personería) gana
gestión disciplinaria. **Hallazgo en el camino:** faltaba también la Capa 2 de gobernanza —
asignar los módulos nuevos a `Dependencia.modulos` (TH y JUR), no solo Capa 1 (tenant) y Capa 3
(grants del cargo); sin la capa 2, Carlos (no-admin) veía "no tienes la capacidad" pese a tener el
grant correcto en su cargo. Corregido con el mismo script-pattern ya establecido.

**Integraciones externas (SIGEP II, SIMO, DIAN, UGPP) — declaradas explícitamente NO construibles:**
ninguna tiene API pública accesible sin convenio institucional — mismo caso ya documentado con
SECOP II ([[secop-integracion-solo-lectura]]). No se fingió ninguna integración.

**✅ VERIFICADO EN VIVO en `demo.ossgovernmentone.lat` con DOS funcionarios no-admin reales:**
- **Carlos Ramirez** (Profesional de Talento Humano): estableció acuerdo de gestión 2026 para
  Héctor Fabio Cruz (evaluador correctamente derivado como "sin jefe inmediato definido" — el
  cargo de Héctor no tiene jefeInmediatoId, comportamiento honesto, no forzado) → calificó 82 →
  **DESTACADO** (cálculo exacto). Registró 1 riesgo en la matriz SST, 1 incidente, 1 examen médico.
  Registró 1 capacitación con inscripción y asistencia. Registró 1 actividad de bienestar con
  participante. Registró 1 permiso sindical.
- Confirmé el LÍMITE correcto: Carlos, sin la capacidad `gestion_disciplinaria`, fue rechazado en
  `/admin/disciplinario` ("No tienes la capacidad").
- Encargué a **Andrés Rojas** (ya Profesional Jurídico titular) como Jefe de Oficina Jurídica vía
  RRHH (acto real, no atajo) → fijé su contraseña de prueba
  ([[feedback-passwords-test-fase-construccion]]) → **abrió `DISC-2026-000001`** sobre Diego López,
  lo archivó tras verificar que no hubo demora injustificada → historial de 2 actuaciones correcto.
- **Planeación del TH** (de vuelta como Carlos): 24 cargos totales, 6 con ocupante, 18 vacantes,
  **75% de vacancia** (aritmética exacta) — dimensionamiento por nivel y por dependencia coherente
  con la estructura real del tenant demo.

**🏁 TALENTO HUMANO COMPLETO — los 9 huecos de la auditoría cerrados** (Historia Laboral +
Certificación, Evaluación del Desempeño, SG-SST, Capacitación, Bienestar Social, Relaciones
Laborales, Gestión Disciplinaria, Planeación del TH, e integraciones externas explícitamente
declaradas fuera de alcance). Junto con Hacienda Pública (Contabilidad+Presupuesto+Tesorería+
Rentas+Cobro Coactivo), quedan **6 huecos menores de Hacienda** como único frente abierto de la
auditoría de módulos — decisión del usuario cuándo seguir.

## Progreso — Evaluación del Desempeño: corregir el flujo real (2026-07-24, commit `44aea5c`)

El usuario corrigió el diseño inicial con una precisión operativa clave: **la calificación NO se
calcula en este sistema** — la realiza el evaluador en la plataforma de la Función Pública; el
funcionario IMPRIME el resultado y lo entrega físicamente a Talento Humano, que simplemente lo
TRANSCRIBE y lo DIGITALIZA. No pidió eliminar nada de lo construido — el acuerdo de gestión
(compromisos) sigue igual; el cambio es de encuadre + un campo nuevo.

**Cambios:** `EvaluacionDesempeno.documentoUrl` (referencia al escaneo/PDF, mismo patrón
sin-storage-real ya usado en `GdAdjunto`/`CapacitacionInscripcion.certificadoUrl`).
`calificarAction` renombrada a `registrarResultadoAction` — mismo cálculo de nivel (la Función
Pública usa la misma escala oficial CNSC), pero reencuadrado explícitamente como TRANSCRIPCIÓN +
verificación cruzada, no como cálculo propio. UI y comentarios del schema actualizados para
explicar el proceso real.

**Verificado en vivo como Carlos (Profesional de Talento Humano):** estableció acuerdo 2026 para
Diego López → registró resultado **94.5 → SOBRESALIENTE** con `documentoUrl` de ejemplo → la
tabla muestra el enlace "Ver escaneo"; el registro previo de Héctor (sin documento) sigue
mostrando "—" correctamente (campo opcional, retrocompatible).

## Auditoría — Secretaría de Planeación (2026-07-24)

El usuario sugirió mirar Planeación como siguiente frente, sin subir un comparativo propio esta
vez (a diferencia de Hacienda/TH) — esta auditoría se basa en conocimiento propio de la norma
colombiana (Ley 152/1994 Plan de Desarrollo, Ley 388/1997 Ordenamiento Territorial, Ley 142/1994
estratificación), declarado honestamente como tal, cruzado contra el código real. Antes de
codear: subagente de investigación confirmó en `personeriabuga` que **no hay nada más que portar**
más allá de Banco de Proyectos (ya portado) — solo existe un `PlanDesarrollo`+`Programa` de
clasificación trivial de 2 niveles, sin metas/indicadores/seguimiento, y ningún modelo de
Estratificación/POT/SISBEN en absoluto.

**Ya construido:** Banco de Proyectos (financiera vs. física, brecha) — completo. Ruteo de
Ventanilla Única + clasificación por IA hacia los cargos de Planeación (ya verificado con el caso
real de "línea de paramento" → Héctor Fabio Cruz).

**Hallazgo del mismo patrón que Hacienda/TH:** la plantilla YA tiene 2 cargos cuyas `funciones`
describen procesos reales sin ningún módulo que los respalde — "Técnico Administrativo —
Estratificación" (funciones: actualizar estratificación) y "Profesional Universitario —
Seguimiento PDM y Contratación" (funciones: seguimiento al PDM) solo tienen `contratacion`/nada
como capacidad real; "Técnico Operativo — Ordenamiento Físico y Territorial" solo tiene
`ventanilla_unica:responder` (recibe la PQRSD pero no hay módulo transaccional para TRAMITARLA).

**No construido:**
1. **Plan de Desarrollo Municipal (PDM) — metas e indicadores** (Ley 152/1994): el documento
   estratégico central de la administración (ejes→programas→metas→indicadores), DISTINTO del
   Banco de Proyectos (que rastrea proyectos individuales de inversión, no el marco estratégico
   del que cuelgan). Hueco más grande y estructural — análogo a "Rentas" en la auditoría de
   Hacienda.
2. **Ordenamiento Territorial (POT) — conceptos de uso de suelo y licencias urbanísticas**
   (Ley 388/1997): el cargo YA existe y YA recibe PQRSD reales sobre esto, pero no hay módulo
   transaccional (solicitud→concepto técnico→expedición) — solo responde la PQRSD genérica.
3. **Estratificación socioeconómica** (Ley 142/1994): estrato por predio, certificados de
   estratificación (documento muy solicitado por ciudadanos) — mismo patrón "barato" que
   Historia Laboral si se modela como reporte simple, pero certificar estrato exige mantener el
   dato del predio (posible reutilización de `RentaPredio` de Rentas, que ya tiene
   `avaluoCatastral`+`estrato`+`destino` por predio).
4. **SISBEN** (identificación de beneficiarios): a veces vive en Planeación, a veces en
   Bienestar/Desarrollo Social — menor prioridad, sin integración externa posible (mismo caso que
   SIGEP/SECOP).

**Nada construido todavía — el usuario decide el orden.**

## Progreso — Ordenamiento Territorial: POT/licencias urbanísticas (2026-07-27, commit `ce94f95`)

El usuario eligió, vía `AskUserQuestion`, atacar primero el hueco "POT / licencias urbanísticas"
de la auditoría de Planeación: el cargo **Técnico Operativo — Ordenamiento Físico y Territorial**
ya existía y ya recibía PQRSD reales sobre línea de paramento/uso de suelo, pero no había módulo
transaccional para tramitarlas más allá de responder la PQRSD genérica.

**Schema** (`SolicitudUrbanistica` + `SolicitudUrbanisticaActuacion` + `UrbanisticoConsecutivo`,
mismo patrón consecutivo-por-año + historial insert-only que Coactivo/Disciplinario): el
solicitante REUSA `Tercero` (no se duplica registro de personas/NIT); el predio se enlaza
OPCIONALMENTE a `RentaPredio` de Rentas cuando ya está registrado para predial, o se captura la
dirección en texto libre si no. 5 tipos de trámite (concepto de uso de suelo, línea de paramento,
licencia de construcción/urbanización/subdivisión); 5 estados (RADICADA→EN_REVISION/
REQUIERE_AJUSTES→APROBADA/NEGADA). Término de ley vía `dias-habiles.ts` (mismo motor que
Ventanilla Única): 15 días hábiles para conceptos/línea de paramento (derecho de petición general,
Ley 1437/2011), 45 días hábiles para licencias (Decreto 1077/2015 art. 2.2.6.1.2.4.1) —
simplificación declarada honestamente: aproximación por tipo de trámite, sin modelar suspensión de
términos por requerimiento de documentos adicionales.

**Capacidad `ordenamiento_territorial` (consultar/tramitar)** + módulo en `/admin/ordenamiento`:
radicar solicitud (calcula automáticamente el vencimiento según el tipo) y registrar actuaciones;
cuando la actuación lleva el estado a APROBADA/NEGADA, captura `concepto` + `fechaRespuesta` +
`respondidoPorId` (quien la registró), igual que el patrón de Disciplinario con el fallo. Plantilla
ALCALDIA: **Técnico Operativo — Ordenamiento** gana `tramitar` (mantiene su `ventanilla_unica:
responder` existente); **Secretario de Planeación** gana `consultar` (supervisión, mismo patrón
de todos los jefes de la sesión).

**Gotcha de las 3 capas, otra vez** ([[feedback-cargos-diferenciados-por-submodulo]]): la
`Dependencia` PLAN tenía `modulos: []` VACÍO desde siempre — un hueco latente preexistente que
nunca había bloqueado nada porque nadie no-admin había ejercido esos cargos hasta ahora. Se
corrigió añadiendo `ventanilla_unica` + `ordenamiento_territorial` al array (Layer 2), además de
Layer 1 (`Tenant.modulosContratados`) y Layer 3 (re-siembra de plantilla).

**Verificado en vivo como Héctor Fabio Cruz** (titular real del cargo, contraseña de prueba fijada
por script — [[feedback-passwords-test-fase-construccion]]) contra la URL desplegada de Vercel
(`demo.ossgovernmentone.lat`): radicó **URB-2026-000001** (línea de paramento, predio real
`00-01-0001-0001-000`, vence 2026-08-17 = 15 días hábiles exactos) → registró actuación intermedia
EN_REVISION (sin concepto de respuesta, correcto para un estado no terminal) → registró actuación
final APROBADA con concepto de respuesta real → la solicitud quedó cerrada mostrando concepto +
"Héctor Fabio Cruz" + fecha, historial de 3 actuaciones completo.

**Quedan de la auditoría de Planeación (decisión del usuario cuándo seguir):** PDM metas e
indicadores (hueco estructural más grande), Estratificación socioeconómica (podría reutilizar
`RentaPredio.estrato` ya existente), SISBEN (baja prioridad). Y de Hacienda Pública: PAC por
fuente, cierre de vigencia, estados financieros CHIP-CGN, boletín de caja, crédito público/
pensiones, Planeación Financiera/MFMP.

## 🏁 SECRETARÍA DE PLANEACIÓN COMPLETA — PDM + Estratificación + SISBEN (2026-07-27, commits
`60e9c12`+`fc928f8`)

El usuario pidió explícitamente "continuemos con todo lo relacionado a planeación, ten en cuenta
lo que ya está construido en el banco de proyectos" — cerrando de una sola pasada los 3 huecos
restantes de la auditoría (Ordenamiento Territorial ya se había cerrado antes).

**PDM** (`PdmPeriodo→PdmEje→PdmPrograma→PdmMeta`+`PdmMetaSeguimiento`, Ley 152/1994): el
seguimiento del indicador es SIEMPRE manual por vigencia (valor acumulado vs. meta del
cuatrienio); `Proyecto` (Banco de Proyectos) gana un `metaId` OPCIONAL — cuando un proyecto
contribuye a una meta, su avance físico (ya calculado por `ejecucionFisicaProyecto`) se muestra
como REFERENCIA junto al seguimiento manual, sin sumarlos automáticamente (proyectos distintos
que aportan a la misma meta pueden medir en unidades incompatibles — sumar sería inventar un dato
falso). Capacidad `pdm` (consultar/administrar/reportar_avance).

**Estratificación**: cero modelo nuevo de predio — reusa `RentaPredio.estrato` de Rentas al 100%;
solo se agregó `EstratificacionCambio` (historial insert-only con motivo, exigible porque el
estrato afecta tarifas reales) + certificado imprimible. Capacidad `estratificacion`
(consultar/actualizar).

**SISBEN**: registro LOCAL de ficha/grupo/puntaje reusando `Tercero` (mismo patrón que Rentas/
Ordenamiento — cero duplicación de identidad); declarado honestamente que el SISBEN real lo
administra el DNP por encuesta + cargue periódico, no hay API pública consultable en vivo. Este
módulo es el registro que Planeación mantiene a partir de esos cargues. Capacidad `sisben`
(consultar/administrar).

**Plantilla ALCALDIA**: los 3 cargos de Planeación que ya existían con solo `funciones`
descriptivas (sin módulo real detrás) ahora tienen capacidad real: Profesional Especializado —
Banco de Proyectos y Plan de Desarrollo gana `pdm:[administrar,reportar_avance,consultar]`
(exactamente lo que sus funciones ya decían); Profesional Universitario — Seguimiento PDM y
Contratación gana `pdm:[reportar_avance,consultar]` (reporta pero no administra la estructura);
Técnico Administrativo — Estratificación se renombra a "Estratificación y SISBEN" y gana
`estratificacion:[consultar,actualizar]`+`sisben:[consultar,administrar]` (mismo patrón de
consolidación realista usado con el Tesorero en Hacienda); Secretario de Planeación gana
`consultar` de los 3 (supervisión, mismo patrón de todos los jefes de esta sesión).

**🐞 Bug real encontrado y corregido en el camino — loop de redirección con sesión de tenant
inválida:** al intentar verificar en vivo, el navegador (que ya había sostenido sesiones de varios
funcionarios de prueba a lo largo de la sesión) quedó con una cookie de sesión válidamente firmada
pero de OTRO tenant/contexto. `requerirFuncionario` redirigía directo a `/ingresar`, pero el
`proxy` (que solo valida la firma del JWT, no el tenant, por diseño — evita tocar la BD en cada
request) veía la cookie como "válida" y rebotaba de vuelta a `/admin/estructura` → loop infinito
(`ERR_TOO_MANY_REDIRECTS`), confirmado con `curl` (sin cookie, ambas rutas responden limpio en un
solo hop) y con `fetch` desde la consola del navegador. Fix: nueva ruta `/salir-forzado` (Route
Handler — a diferencia de una página, SÍ puede escribir cookies) que limpia la sesión antes de
mandar a `/ingresar`; `requerirFuncionario` ahora redirige ahí en vez de a `/ingresar` cuando
`sesion.tenantId !== ctx.tenant.id`. Es un caso límite (cookie cruzada de tenant en un navegador
compartido de pruebas) que difícilmente afecta a un usuario real, pero es defensa en profundidad
real, no cosmética.

**🐞 Segundo hueco de la Capa 2 encontrado — `banco_proyectos` NUNCA estuvo en `Dependencia.modulos`
de PLAN:** Banco de Proyectos llevaba verificado desde hace semanas, pero SIEMPRE como el admin
del tenant (que salta las capas 2 y 3) — nunca como un funcionario real de Planeación. Al loguear
a Paula (con la capacidad real `banco_proyectos:administrar` en su cargo) apareció "no tienes
capacidades de Banco de Proyectos" pese a tener el grant correcto — la Capa 2 nunca se había
cerrado para ese módulo en PLAN. Corregido añadiéndolo al array. **Confirma otra vez la lección de
[[feedback-cargos-diferenciados-por-submodulo]]: verificar SIEMPRE con el funcionario real de la
dependencia, nunca dar por bueno un módulo solo porque el admin lo ve.**

**Verificado en vivo end-to-end contra `demo.ossgovernmentone.lat`, con 3 funcionarios reales
nuevos** (Paula Restrepo, Eliana Gómez, Néstor Villegas — nombres tomados del propio ejemplo real
que dio el usuario semanas atrás para Planeación) **+ Beatriz Torres (encargada de Secretario)**:
- Paula creó el Plan de Desarrollo 2024-2027 completo (eje→programa→meta "Km de vía urbana
  pavimentados", línea base 12/meta 20), creó `PRY-2026-002` en Banco de Proyectos enlazado a esa
  meta, reportó 40% de avance físico del proyecto, y registró el seguimiento manual de la meta
  (15.8/20 km = 79% exacto) — la tarjeta de la meta mostró AMBOS números correctamente separados
  ("← PRY-2026-002 (40% físico)" como referencia, 79% como el seguimiento real).
- Néstor actualizó el estrato del predio de prueba (sin registrar → 3) con motivo e historial, y
  generó el certificado de estratificación con el estrato real; registró una ficha SISBEN real
  (grupo B, puntaje 32.5) y generó su certificado; fue correctamente RECHAZADO en `/admin/pdm`
  ("no tienes la capacidad pdm").
- Beatriz (Secretaria de Planeación, encargada) vio el PDM en modo SOLO CONSULTA (sin ningún
  formulario de administración), confirmando el patrón de supervisión de jefe aplicado
  consistentemente en toda la plataforma.

**🏁 AUDITORÍA COMPLETA DE SECRETARÍA DE PLANEACIÓN CERRADA** (Banco de Proyectos + Ordenamiento
Territorial + PDM + Estratificación + SISBEN, los 4 huecos identificados + Banco de Proyectos ya
existente). Junto con Hacienda Pública y Talento Humano, quedan como único backlog documentado:
los 6 huecos menores de Hacienda (PAC por fuente, cierre de vigencia, estados financieros
CHIP-CGN, boletín de caja, crédito público/pensiones, Planeación Financiera/MFMP) — decisión del
usuario cuándo seguir.

## Progreso — Reestructura real de Secretaría de Planeación + PDM multi-secretaría (2026-07-27,
commits `e62aacc`+`c648e9f`)

El usuario corrigió la estructura de Planeación con el organigrama real de una secretaría grande
(a diferencia de Hacienda/TH, que quedan FLAT con cargos diferenciados en una sola dependencia,
Planeación pidió sub-dependencias reales): Despacho (Secretario, se queda en PLAN), Secretaría del
Secretario (asistente ejecutivo), Ventanilla Única propia, Contratación propia, Alumbrado Público,
Estratificación (separada), COTE (ver corrección abajo), Banco de Proyectos (con seguimiento al
PDM como su función central), MIPG/FURAG, y Ordenamiento Físico y Territorial con DOS
sub-dependencias hijas nuevas — Avisos y Tableros (publicidad exterior visual, Ley 140/1994) y
Espacio Público — ninguna con módulo transaccional propio todavía (mismo patrón de siempre:
estructura + `funciones` ahora, módulo cuando llegue su turno).

**Corrección del usuario en el camino:** "COME — Comité Municipal de Estadística" asumía que la
plataforma es solo para municipios — se corrigió a **COTE — Comité Territorial de Estadística**
(la plataforma sirve alcaldías, personerías y otros tipos de entidad, no solo municipios).

**Requisito funcional nuevo, ya implementado:** un PROGRAMA del PDM puede depender de VARIAS
secretarías — muchos proyectos de dependencias distintas pueden apuntar a las metas de un mismo
programa sin pertenecer a la dependencia "líder" del programa. `/admin/pdm` ahora agrega, por
programa, la lista ÚNICA de proyectos contribuyentes (de cualquier secretaría) con su dependencia
responsable, contribución financiera/física (`ejecucionProyecto`), y los CONTRATOS reales que lo
financian (cadena `Proyecto→Cdp→Rp→Contrato→Tercero`, la misma que ya alimentaba
`ejecucionFinanciera`) con su contratista.

**🐞 Bug real encontrado y corregido de paso:** `/admin` (raíz del panel del tenant) redirigía
siempre a `/admin/estructura`, que exige rol ADMIN/SUPER_ADMIN — un funcionario NO-admin que
navegara directo a `/admin` (o a quien `requerirRolTenant` rebotara ahí) quedaba en
`ERR_TOO_MANY_REDIRECTS` (mismo síntoma del bug de sesión cruzada ya arreglado, causa distinta:
esta vez es lógica de la propia app, no la cookie). Fix: `/admin` ahora redirige al primer módulo
VISIBLE del funcionario, o muestra un mensaje si no tiene ninguno — nunca de vuelta a una página
que lo va a rechazar.

**Migración del tenant demo:** se sembraron las 11 sub-dependencias nuevas, se MOVIERON (no se
recrearon) los 3 cargos reales con vinculaciones vivas (Paula→Banco de Proyectos, Néstor→
Estratificación, Héctor→Ordenamiento Físico) a sus nuevas sub-dependencias preservando su
`cargoId`/historial, se retiró el cargo combinado "Profesional Universitario — Seguimiento PDM y
Contratación" (sus dos funciones ya viven cada una en su propio sitio: PDM en Banco de Proyectos,
Contratación en el nuevo PLAN-CONT) re-vinculando a Eliana con un acto administrativo real al
nuevo cargo, y se asignó `Dependencia.modulos` (Capa 2) de forma independiente por sub-dependencia
en vez de un solo array compartido en PLAN.

**Verificado en vivo:** Paula (ya movida a la nueva sub-dependencia Banco de Proyectos) siguió
operando sin fricción; se creó `PRY-2026-003` (Señalización Vial) liderado por HAC apuntando a la
MISMA meta que `PRY-2026-002` (liderado por PLAN) — la vista de programa mostró ambos proyectos
con su secretaría correcta; se enlazó `PRY-2026-001` (que ya tenía un contrato real `C-2026-003`
con contratista "Contribuyente de prueba S.A.S." desde la verificación de Contratación) a la misma
meta, y su contrato+contratista aparecieron correctamente anidados bajo el proyecto — los 3
proyectos de 3 secretarías distintas (PLAN, HAC, ATC) conviviendo bajo un mismo programa, exacto
al requisito pedido.

## Progreso — Alcance particular vs. global en Contratación y Banco de Proyectos (2026-08-03)

**Hueco señalado por el usuario:** "cada secretaría tiene contratación y le hace seguimiento en
ejecución/financiero a lo que le corresponde ejecutar del PDM; Planeación (y Hacienda) además le
hacen seguimiento GENERAL — por secretaría, por proyecto, por programa." Verificado en el código:
`/admin/contratacion` y `/admin/proyectos` (Banco de Proyectos) NO filtraban por dependencia —
cualquier funcionario con la capacidad veía TODOS los contratos/proyectos del tenant, de cualquier
secretaría (un profesional de `PLAN-CONT` veía también los contratos de Hacienda o Gobierno).
`/admin/pdm` ya tenía la agregación cruzada de secretarías (commit `e62aacc`), pero eso no compensa
el hueco de los otros dos módulos.

**Modelo de acceso (reutiliza dato ya existente, sin capacidad nueva):** `Dependencia.
esServicioCompartido` ya significaba "sirve a TODAS las dependencias" (Jurídica, Contratación
central). Se generaliza esa misma regla:
- Nueva función `alcanceDependencias` (`src/lib/dominio/acceso.ts`): si el funcionario ejerce en
  una dependencia `esServicioCompartido` → `veGlobal=true` (ve todo el tenant). Si no → calcula la
  FAMILIA (la secretaría/oficina de primer nivel bajo el despacho + todos sus descendientes,
  recursivo — cubre casos como Ordenamiento Físico→Avisos/Espacio Público, 3 niveles) y solo ve
  eso. Ojo con la raíz: subir hasta el tope ABSOLUTO del árbol (el despacho, del que cuelgan todas
  las secretarías) hace que la familia de cualquiera termine siendo el tenant entero — hay que
  parar un nivel antes (la secretaría misma).
- `Banco de Proyectos` (`PLAN-BP`) se marcó `esServicioCompartido: true` — por diseño ya hace
  seguimiento de TODAS las dependencias (su propio texto de funciones lo decía), solo faltaba
  reflejarlo en el dato. Con esto, Planeación mantiene su vista global existente sin cambios, y el
  resto de secretarías (si algún día tienen banco_proyectos/contratación propios) automáticamente
  quedan en modo particular sin código adicional.
- `/admin/contratacion`: filtra contratos por `rp.cdp.proyecto.dependenciaId` en la familia, UNIDO
  con `estructuradorId` de cualquiera de la familia (`usuariosDeAlcance`) — cubre el caso real de
  un contrato BORRADOR sin RP/CDP aún (no tiene cómo trazarse a una dependencia por el proyecto).
  También filtra `rpsDisponibles` (el selector de RP al crear un contrato nuevo) con el mismo
  criterio.
- `/admin/proyectos`: filtra `Proyecto.dependenciaId` directo.
- Ambas páginas muestran un badge "Viendo: tu secretaría" / "Viendo: todas las secretarías".
- Hacienda no necesitó cambios: Contabilidad/Presupuesto/Tesorería ya son tenant-wide por
  naturaleza (un solo libro mayor), eso YA es su vista global con enfoque financiero.
- `/admin/pdm` se dejó sin tocar: su capacidad (`pdm`) ya es exclusiva de Planeación en la plantilla
  actual, y es justamente la vista global que el usuario pidió — filtrarla habría regresado la
  funcionalidad recién construida.

**Verificado en vivo** (`scripts/verify-alcance.ts` contra el tenant demo real, no mock): Paula
(Banco de Proyectos, ahora servicio compartido) → `veGlobal=true`. Eliana (`PLAN-CONT`, NO
compartido) → familia resuelta a exactamente las 12 dependencias de Planeación (excluye HAC/ATC/
GOB); de los 3 proyectos del tenant, ve solo 1 (el de PLAN) en modo particular, contra los 3 que ve
Paula en modo global — la discriminación funciona. `scripts/reaplicar-plantilla.ts` (nuevo, reusa
`aplicarPlantilla` que ya es idempotente) propagó `esServicioCompartido=true` al tenant demo ya
sembrado sin migración de schema (el campo ya existía).

## Progreso — Secretaría de Gobierno: estructura + Ventanilla Única (sin módulo propio) (2026-08-03)

El usuario pidió arrancar Gobierno (siguiente secretaría en la cola, ver auditoría anterior:
solo tenía el Secretario, sin sub-estructura) pero **sin profundizar todavía** — solo crear las
dependencias reales y conectarlas a Ventanilla Única, porque él mismo no conoce el detalle de cada
área. Investigado (no descrito por el usuario esta vez, sin comparativo PDF): son las 6 áreas casi
universales de una Secretaría de Gobierno municipal colombiana — Comisaría de Familia (Ley
294/1996, Ley 1098/2006, Ley 2126/2021), Inspección de Policía (Ley 1801/2016), Convivencia y
Seguridad Ciudadana (PISCC), Participación Ciudadana y Acción Comunal (Ley 743/2002), Enlace de
Víctimas (Ley 1448/2011), Gestión del Riesgo de Desastres/CMGRD (Ley 1523/2012).

Cada una: un cargo, `funciones` descriptiva con el fundamento legal, y **únicamente**
`grants: { ventanilla_unica: ["responder"] }` — ningún módulo/capacidad propia todavía (mismo
patrón que Alumbrado Público/Espacio Público de Planeación antes de su turno).

**Hueco encontrado al sembrar:** `aplicarPlantilla` fija `esServicioCompartido`/`nombre`/`tipo`/
`padreId` pero NUNCA toca `Dependencia.modulos` (Capa 2) — una dependencia nueva nace con
`modulos=[]`, así que el grant `ventanilla_unica:responder` del cargo queda inerte (la Capa 2 lo
bloquea) hasta que alguien se lo asigne a mano en `/admin/estructura`. Se completó a mano (mismo
efecto que la UI) para las 6 nuevas: `modulos=["ventanilla_unica"]`. **Pendiente recordar:** cada
plantilla nueva con conexión a un módulo base necesita este segundo paso — `aplicarPlantilla` NO lo
hace solo.

**Verificado contra el tenant demo real** (no mock): las 6 dependencias (`GOB-COMFAM`,
`GOB-INSPOL`, `GOB-CONVIV`, `GOB-PART`, `GOB-VICT`, `GOB-GRD`) quedaron sembradas bajo `GOB`, cada
una con su cargo y `modulos=["ventanilla_unica"]` confirmado por query directa.

**Decisión del usuario (2026-08-03, cierra el tema — no re-litigar):** Comisaría de Familia NO
necesita módulo transaccional propio en Government One — el usuario ya tiene **GEFA** (sistema
externo) para la gestión real de casos de esa dependencia. Por la misma razón/alcance, Inspección
de Policía **tampoco** — ambas quedan, de forma DEFINITIVA (no temporal), solo respondiendo PQRSD
vía Ventanilla Única. Es decir: lo que ya está sembrado (estructura + `ventanilla_unica:responder`
únicamente) **es el estado final de estas dos**, no un scaffolding a la espera de su turno — no
hace falta investigar ni construir sus procesos (VIF/PARD, querellas/comparendos) dentro de esta
plataforma. Queda como punto de interoperabilidad futura si algún día se integra con GEFA (ver
`REFERENCIA_interoperabilidad_estatal.md`), no como módulo propio.

Las 4 sub-dependencias restantes de Gobierno (Convivencia y Seguridad Ciudadana, Participación
Ciudadana, Enlace de Víctimas, Gestión del Riesgo) siguen abiertas a que se les construya módulo
propio cuando les toque el turno — sin decisión tomada aún sobre ellas.

## Progreso — Editor de capacidades (Capa 3) por cargo en `/admin/estructura` (2026-08-03)

**Hueco cerrado:** el usuario preguntó si había forma de crear una dependencia que no estuviera
ya en la plantilla — sí (`crearDependenciaAction`/`crearCargoAction`/`asignarModulosDependenciaAction`,
todo ya en vivo), pero un cargo creado por esa vía nacía con `grants: {}` y **no había ninguna
acción en la UI para asignarle capacidades después** — solo `aplicarPlantilla` (código +
resembrar) escribía `Cargo.grants`. El admin del tenant no podía cerrar el ciclo solo.

**Cerrado:** `asignarGrantsCargoAction` (`src/app/admin/estructura/actions.ts`) — checkboxes
`"modulo:capacidad"` validados contra `esCapacidadValida` (catálogo `CAPACIDADES_POR_MODULO`),
mismo patrón que `asignarModulosDependenciaAction`. Componente `GrantsCargo`
(`src/app/admin/estructura/grants-cargo.tsx`), mirror exacto de `ModulosDependencia`. Solo ofrece
capacidades de los módulos YA asignados a la dependencia (Capa 2) — si la dependencia no tiene
módulos, muestra "asígnalos arriba primero" en vez de una lista vacía inútil.

**Verificado en vivo de verdad** (no solo tsc): se creó `.claude/launch.json` (dev server local,
puerto 3000; el repo ya tenía `DEV_TENANT_SLUG=demo` en `.env` para rutear tenant sin subdominio
real) y se entró como `admin.demo@gov1.test` (contraseña de prueba fijada por script,
[[feedback-passwords-test-fase-construccion]]). Se marcó `ventanilla_unica:radicar` en el cargo
Comisario de Familia (que solo tenía `responder`), se guardó, el chip apareció de inmediato y
`Cargo.grants` en la BD quedó `{"ventanilla_unica":["radicar","responder"]}` — confirmado por
query directa. Revertido a `{"ventanilla_unica":["responder"]}` para no dejar el dato de prueba
sobre la estructura real de Gobierno.

## Progreso — Participación Ciudadana (JAC) + Gestión del Riesgo (CMGRD) — 2 módulos nuevos (2026-08-03)

De las 4 sub-dependencias de Gobierno que quedaron abiertas, se construyó módulo transaccional
propio para las 2 con valor claro (las otras 2 — Convivencia y Seguridad Ciudadana, Enlace de
Víctimas — son más de coordinación/seguimiento sin "expediente" real, quedan pendientes).

**Participación Ciudadana y Acción Comunal** (`participacion_ciudadana`) — registro de Juntas de
Acción Comunal (Ley 743/2002): `Jac` (nombre, barrio/vereda, personería jurídica, estado) +
`JacDignatario` (insert-only por período — Presidente/Vicepresidente/Secretario/Tesorero/Fiscal/
Vocal, 4 años) **reusando `Tercero`** para la identidad de la persona (mismo patrón que Rentas/
SISBEN, no se duplica). Certificado de existencia y representación en
`/admin/participacion-ciudadana/certificado`.

**Gestión del Riesgo de Desastres** (`gestion_riesgo`) — registro AGREGADO de emergencias
atendidas por el CMGRD (Ley 1523/2012): `EmergenciaGrd` (tipo de evento, fecha, ubicación,
familias/personas afectadas, consecutivo `EMG-2026-NNN` igual que Proyecto/Contrato) +
`EmergenciaAyudaGrd` insert-only (ayudas entregadas, trazabilidad ante entes de control).
Deliberadamente NO nominal (no se registra el nombre de cada damnificado — así reporta un
municipio real a la UNGRD) y sin sesiones de CMGRD todavía (se agrega si hace falta después).

**Hueco recurrente confirmado (tercera vez):** además de `aplicarPlantilla` no tocar
`Dependencia.modulos` (Capa 2, ya sabido), un módulo CONTRATABLE nuevo tampoco aparece en el nav ni
pasa la Capa 1 hasta que el superadmin lo agregue a `Tenant.modulosContratados` (meta-DB) — un
paso MÁS que sembrar la estructura. Se hizo con `scripts/set-tenant-modulos.ts` para el demo.
Checklist real para un módulo contratable nuevo: (1) migrar schema, (2) capacidad en
`capacidades.ts`, (3) entrada en `modulos.ts`, (4) grant en `plantillas-cargo.ts` + resembrar,
(5) `Dependencia.modulos` (Capa 2), (6) `Tenant.modulosContratados` (Capa 1, meta-DB).

**Verificado en vivo end-to-end** contra el tenant demo real: se creó la JAC "JAC Barrio El Prado",
una persona nueva (María Fernanda Ospina), se registró como Presidenta (período 2025-07-01 a
2029-06-30) y el certificado la mostró correctamente. Se registró la emergencia `EMG-2026-001`
(inundación, Barrio Ribera del Río, 12 familias/45 personas), se le agregó una ayuda (12 mercados)
y se cerró — los contadores y estados se actualizaron en cada paso.

## Progreso — Convivencia y Seguridad Ciudadana + Enlace de Víctimas — cierra Gobierno (2026-08-03)

Cierra las 2 sub-dependencias de Gobierno que quedaban sin decisión. Con esto, las 6
sub-dependencias de Gobierno quedan resueltas: 4 con módulo propio (Participación Ciudadana,
Gestión del Riesgo, y estas 2), 2 solo-PQRSD por decisión ya tomada (Comisaría de Familia,
Inspección de Policía — GEFA externo).

**Convivencia y Seguridad Ciudadana** (`convivencia_seguridad`) — seguimiento al Consejo de
Seguridad y al PISCC: `SesionConsejoSeguridad` (acta: fecha, tema, resumen) + `AcuerdoConsejoSeguridad`
(descripción, responsable, plazo, estado PENDIENTE/CUMPLIDO). A diferencia de las ayudas
insert-only de otros módulos, el acuerdo es MUTABLE (se marca cumplido) — no es un expediente con
partes, es coordinación interinstitucional.

**Enlace de Víctimas** (`enlace_victimas`) — Ayuda Humanitaria Inmediata (AHI, Ley 1448/2011):
`AhiEntrega` (persona —REUSA `Tercero`—, hecho victimizante, fecha del hecho, fecha de entrega,
tipo de ayuda), insert-only. El RUV es nacional (Unidad para las Víctimas), no se construye acá.
A diferencia de Gestión del Riesgo, esta SÍ es nominal (por persona) — es una prestación
individual con responsabilidad de reporte, no una cifra agregada de afectación.

**Checklist del módulo contratable nuevo, ya aprendido, seguido sin sorpresas:** migrar schema →
capacidad → `modulos.ts` → grant en plantilla + resembrar → `Dependencia.modulos` (Capa 2) →
`Tenant.modulosContratados` (Capa 1, meta-DB).

**Verificado en vivo end-to-end** contra el tenant demo real: sesión "Seguimiento hurtos zona
centro" (2026-08-01) con acuerdo "Aumentar patrullaje nocturno" asignado al Comandante de Policía
→ marcado CUMPLIDO. AHI para María Fernanda Ospina (desplazamiento, hecho 2026-07-28, entrega
2026-07-29, alojamiento transitorio + mercado) registrada correctamente, reusando el `Tercero` ya
creado en Participación Ciudadana — confirma que la identidad externa se comparte entre módulos
como está diseñado.

# Plan de implementación — Módulo base: Portal Institucional

> **Arranque servido para la próxima sesión.** Bundle base del rebuild (CLAUDE.md §Orden 2):
> **Portal público + Gestión Documental + Ventanilla Única + administración de la estructura organizacional.**
> Grounded en lo que YA existe; construir sub-pieza por sub-pieza, cada una **verificada en vivo** antes de la
> siguiente (regla de oro 3). Cero hardcode de entidad; todo sale de la data del tenant.

## 0. Qué ya existe y se reutiliza (no reinventar)
- **Ruteo de tenant por host:** `src/lib/tenant-db.ts` (`getTenantPrisma(host)`, `resolveTenantByHost`).
- **Schema del tenant:** `Dependencia` (árbol), `Cargo` (grants), `Usuario`, `VinculacionCargo`, `Ausencia`
  (`prisma/tenant/schema.prisma`). Migraciones por-tenant vía `applyTenantSchema` / `provision-schema.sql`.
- **Fundación de dominio:** `src/lib/dominio/` — `capacidadesEfectivas`, `tieneCapacidad`, **`quienEjerce`**,
  `cabezaDeDependencia`, `aplicarPlantilla`, catálogo `CAPACIDADES_POR_MODULO`.
- **Patrón UI:** server components + server actions + `useActionState` (ver `superadmin/cms`), auth/DAL
  (`requerirAdmin`) — para el tenant hará falta su **propio** auth de funcionario (ver §5).
- **CMS de plataforma:** `PaginaCms`/`BloqueCms` (meta-DB) — patrón a reusar para el micrositio del tenant,
  pero el contenido del portal vive en la **BD del tenant**, no en la meta.

## 1. Orden de construcción (cada paso verificado en vivo)

### Paso A — Estructura organizacional (admin del tenant)
Primero lo que da la columna: administrar dependencias/cargos/vínculos (lo que la plantilla siembra).
- **Wire de la plantilla:** llamar `aplicarPlantilla(dbTenant, tenant.tipoEntidad)` al provisionar (o un
  botón "sembrar estructura" en el admin del tenant). Hoy `aplicarPlantilla` existe pero **no está cableado**
  en `provision.ts`.
- **UI admin (`/admin/estructura`):** árbol de dependencias, cargos por dependencia (con sus grants), y
  vínculos persona↔cargo (titular/encargado/provisional + vigencia). CRUD con server actions.
- **Verificar:** sembrar plantilla en un tenant real de prueba; crear un funcionario y vincularlo a un cargo;
  ver `capacidadesEfectivas` reflejada en su acceso.

### Paso B — Gestión Documental (núcleo: TRD + radicación)
- **Schema tenant (nuevos modelos):** `Trd` (tabla de retención documental / series-subseries),
  `Radicado` (consecutivo por vigencia, tipo entrada/salida/interno, `dependenciaId`, `estado`, adjuntos),
  `Documento`/adjunto. Consecutivo **por tenant** (no global).
- **Capacidades:** `gestion_documental: [radicar, archivar, consultar, administrar_trd]` (ya en el catálogo).
- **Verificar:** radicar un documento entrante en un tenant → aparece en su bandeja; consecutivo correcto.

### Paso C — Ventanilla Única (PQRSD con ruteo por cargo)
El diferenciador. La PQRSD entra y se **asigna automáticamente al funcionario que corresponde**.
- **Schema tenant:** `Pqrsd` (tipo P/Q/R/S/D, canal, peticionario, `dependenciaId`, `cargoAsignadoId`,
  `usuarioAsignadoId`, `estado`, tiempos de ley, adjuntos) — se apoya en `Radicado` de GD.
- **Ruteo:** reglas (por asunto/competencia de dependencia) → recomienda un **`Cargo`** → **resolver el
  funcionario con `quienEjerce(cargo)`** (ENCARGADO→TITULAR sin ausencia→fallback `cabezaDeDependencia` →
  dependencia de servicio compartido). *Aquí se cablea la fundación de dominio.*
- **IA (opcional, fase 2):** clasificación del asunto con la **key IA POR-TENANT** (nunca la de plataforma →
  [[regla-oro-credenciales-por-tenant]]); guardar secreto cifrado en `Tenant.secretosEncriptados`.
- **Verificar:** radicar una PQRSD → se asigna al titular del cargo competente; marcar ausencia del titular →
  la siguiente se va al encargado; medir que respeta los tiempos de ley.

### Paso D — Portal público (micrositio del tenant + Ley de Transparencia)
- **Ruteo host:** `getTenantPrisma(host)` ya resuelve el tenant; renderizar el **portal público** del tenant
  en su dominio (subdominio gestionado o dominio propio). Home + secciones Gov.co / Res. 1519 (Transparencia),
  directorio de dependencias (del árbol), y **formulario público de PQRSD** que entra a la Ventanilla Única.
- **Contenido:** micrositio editable (mismo patrón `BloqueCms`, pero en la BD del tenant) administrado desde
  el admin del tenant.
- **Verificar:** entrar por el host de un tenant → ver su portal con SUS datos (cero hardcode); enviar una
  PQRSD desde el formulario público → cae en la Ventanilla Única del tenant.

## 2. Dónde se cablea la fundación de dominio
- **Gating de acciones:** `tieneCapacidad(db, usuarioId, modulo, cap)` en cada server action (radicar, asignar,
  responder, administrar_trd…). Nada mira el rol para funciones.
- **Ruteo/aprobación:** `quienEjerce(cargo)` + `cabezaDeDependencia(dependencia)` para asignar y para fallbacks.
- **Servicios compartidos:** `Dependencia.esServicioCompartido` decide qué dependencia atiende transversalmente.

## 3. Migraciones del tenant (importante)
Los modelos nuevos (GD, VU, micrositio) son **cambios de schema del tenant** → tocan a TODOS los tenants.
Hoy no hay orquestador de migraciones fan-out (pendiente del plano de control). Para este módulo:
- Regenerar `prisma/tenant/provision-schema.sql` (`migrate diff --from-empty …`) y **versionar** el bump de
  `schemaVersion`. Aplicar a los tenants existentes de prueba con un script controlado (no a mano en prod).
- **Antes de crecer:** formalizar `prisma/tenant/migrations` + fan-out (el #1 del plano de control).

## 4. Auth de funcionario del tenant (distinto del superadmin de plataforma)
- El superadmin de plataforma (`AdminPlataforma`, meta-DB) **no** sirve para el tenant. El funcionario se
  autentica contra la **BD del tenant** (`Usuario`). Reusar el patrón de sesión (`jose` + cookie httpOnly +
  `proxy`/DAL) pero con **contexto de tenant** (la sesión debe atar `tenantId`/host + `usuarioId`).
- Login del funcionario en el host del tenant; `/admin/*` del tenant protegido por su propia sesión + capacidad.

## 5. Prerrequisitos / decisiones abiertas (desbloquear antes o durante)
- **Storage de adjuntos** (PQRSD/GD): decidir proveedor (R2/S3), credencial **por-tenant**. Bloquea adjuntar
  archivos; el flujo de texto se puede construir antes.
- **Key IA por-tenant** para clasificación de VU (fase 2; el ruteo por reglas funciona sin IA).
- **Provisioning asíncrono**: sembrar plantilla + aplicar schema puede exceder el timeout de Vercel Hobby →
  a escala, job async.

## 6. Criterio de "terminado" del módulo base
Un tenant nuevo: se provisiona → se siembra su estructura (plantilla por tipo) → un funcionario entra, radica
y responde PQRSD ruteadas por cargo → el ciudadano ve el portal público del tenant y radica desde ahí. Todo
con los datos del tenant, cero hardcode, verificado en vivo en el navegador.

---
**Retomar por el Paso A** (estructura organizacional del tenant), que apoya en `aplicarPlantilla` +
`src/lib/dominio/` ya listos. Ver [[punto-de-retoma]] y `REBUILD_bitacora.md`.

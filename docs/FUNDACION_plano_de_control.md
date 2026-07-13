# Fundación de infraestructura: el PLANO DE CONTROL (multi-tenant a escala)

> La segunda mitad de la fundación. Hace real la "escala masiva agresiva" con **BD Neon por tenant**.
> Regla: **nunca más migraciones a mano.** El plano de control es producto de primera clase.
> Grounded en lo que ya existe en `../personeriabuga/` (verificado 2026-07-12).

---

## 0. Qué YA existe (no se reinventa — se re-deriva limpio y se automatiza)

| Pieza actual | Archivo | Estado / qué le falta a escala |
|---|---|---|
| Cliente meta-DB | `src/lib/prisma-meta.ts` (`prismaMeta`) | ✅ el directorio de tenants. A escala = el linchpin del control plane |
| Crear proyecto Neon | `src/lib/provisioning/neon.ts` (`createNeonProject`) | ✅ existe; falta **cola + rate-limit** (async) |
| Aplicar schema a BD nueva | `src/lib/provisioning/schema-apply.ts` | ✅ corre `provision-schema.sql`; falta versionado |
| Orquestador de alta | `src/lib/provisioning/provision.ts` (`provisionTenant`) | ✅ síncrono vía CLI; falta hacerlo **asíncrono/idempotente** |
| DDL completo | `prisma/provision-schema.sql` | ✅ regenerable; será el "schema v0" del nuevo esquema |
| Migración a tenants existentes | `POST /api/admin/db/ensure-schema` (DDL hardcodeado, **manual, por tenant**) | 🔴 **NO sobrevive a escala** — se reemplaza por orquestación automática |
| Ruteo de tenant | `src/lib/tenant.ts` (`getTenantPrisma` por host) | ✅ resuelve por Host; falta **caché** + límites de conexión Neon |
| Secretos por tenant | `TenantSecretos` cifrado (`encryption.ts`) | ✅ patrón sólido (IA/SMTP/WhatsApp/SECOP/storage por tenant) |

---

## 1. Los componentes del plano de control

### 1.1. Meta-DB (control-plane DB) — `prismaMeta`
- Base **compartida** (una sola) que es el **directorio** de la flota: registro `Tenant` (slug, dominio,
  connection strings, plan, módulos activos, `secretosEncriptados`, **versión de schema del tenant**).
- A escala es la pieza más crítica: toda resolución de tenant y toda orquestación de migración la lee.
- **Nuevo campo clave:** `schemaVersion` por tenant (para saber qué migraciones le faltan).

### 1.2. Ruteo de tenant (host → tenant → conexión)
- `Host` del request → `Tenant` (meta-DB) → connection string (pooled). Cachear el mapeo host→tenant
  (LRU/edge cache) para no pegarle a la meta-DB en cada request.
- **Conexiones (dato confirmado, ver `VERIFICACION_neon_escala.md`):** con miles de BDs NO se mantienen
  pools abiertos a todas → siempre contra el **pooler de Neon (PgBouncer)**, apoyándose en scale-to-zero
  para los inactivos. Prisma con connection string *pooled* por request.

### 1.3. Provisioning ASÍNCRONO (cola + worker)
- Alta de tenant = job en cola, **no** un request serverless síncrono (crear proyecto Neon + aplicar
  schema + sembrar catálogos + registrar en meta-DB tarda y puede toparse con rate-limits de la API Neon).
- **Idempotente y resumible:** si falla a mitad, se reintenta desde el paso pendiente (estados:
  `CREANDO_NEON → APLICANDO_SCHEMA → SEMBRANDO → ACTIVO / FALLIDO`). Rollback (borrar proyecto Neon) si aborta.
- Reusa `provisionTenant` como lógica, pero disparada por **worker**, no por CLI/HTTP síncrono.

### 1.4. 🔴 Orquestación de MIGRACIONES (el #1 — lo que reemplaza `ensure-schema` manual)
El corazón del plano de control a escala. Requisitos:
- **Migraciones versionadas** (v1, v2, …), cada una idempotente y aditiva/segura (mismo espíritu que el
  patrón DDL-en-dos-pasos actual, pero formalizado). Fuente única, no SQL suelto por endpoint.
- **Fan-out** sobre TODAS las BDs de tenant: un runner recorre la flota (desde la meta-DB), aplica las
  migraciones que le faltan a cada tenant según su `schemaVersion`, y **avanza `schemaVersion`** al éxito.
- **Resumible y tolerante a fallos:** por tenant, con reintentos; un tenant que falla no bloquea la flota;
  reporte de qué tenants quedaron atrás.
- **Sin downtime:** migraciones expand/contract (agregar antes de leer; nunca romper el código en vuelo).
- **Concurrencia controlada** (respetar rate-limits de Neon; ver B3 en la verificación).
- Corre como **job de worker** (no serverless), disparado en cada deploy que incluya migraciones nuevas.
- **Observabilidad:** tablero de "versión de schema por tenant" + alertas de tenants rezagados.

### 1.5. Secretos por tenant
- `TenantSecretos` cifrado en la meta-DB (AES-256-GCM) — patrón ya sólido. Todo servicio credenciado
  (IA, storage, SMTP, WhatsApp, SECOP) por tenant, nunca de plataforma. Se conserva tal cual.

### 1.6. Observabilidad / agregación cross-tenant
- Con la data partida en N BDs, los tableros de plataforma (superadmin) NO consultan N bases en vivo:
  agregación periódica (worker) hacia la meta-DB o un almacén analítico. Métricas: # tenants por estado,
  versión de schema, uso, provisioning en curso, migraciones rezagadas.

---

## 2. Principios

- **Nunca migraciones a mano.** `ensure-schema` manual muere; lo reemplaza el orquestador (1.4).
- **Meta-DB = fuente de verdad del control plane.** Ruteo, provisioning y migraciones la leen.
- **Todo lo pesado va a un worker/cola**, no a serverless (provisioning, migraciones fan-out, agregación).
- **Idempotencia y resumibilidad** en provisioning y migraciones (a escala, los fallos parciales son la norma).
- **Aislamiento fuerte** (BD por tenant) se conserva; el precio es la orquestación — por eso es de primera clase.

## 3. Dependencias externas a cerrar (no bloquean el diseño, sí el "prometer escala")
- `VERIFICACION_neon_escala.md` → **B1** (¿hasta cuántos proyectos sube Neon?) y **B2** (precio a escala)
  con Neon-sales; **B3** (rate-limit de provisioning) define la concurrencia del orquestador.

## 4. Qué se construye en la fase Fundación (antes de cualquier módulo)
1. Meta-DB con `Tenant` + `schemaVersion` + estados de provisioning.
2. Ruteo de tenant con caché (host→tenant→conexión pooled).
3. Provisioning asíncrono (cola + worker, idempotente/resumible/rollback).
4. **Orquestador de migraciones versionadas con fan-out** (el entregable central).
5. Secretos por tenant (portar el patrón cifrado).
6. Tablero mínimo de observabilidad de la flota (estado + versión de schema por tenant).

> **Estado:** plano de control CERRADO a nivel conceptual sobre terreno verificado. Con esta hoja + la
> de dominio, la fundación queda completa → siguiente paso: **scaffolding Next.js del proyecto nuevo**,
> empezando por esta fundación (control plane + dominio), verificada en vivo, antes de cualquier módulo.

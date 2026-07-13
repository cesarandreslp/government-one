# Verificación de límites de Neon para escala masiva (BD por tenant)

> **Objetivo:** convertir "Neon aguanta escala agresiva con BD por tenant" de **promesa** a **dato**.
> Decisión ya tomada: **una BD Neon por tenant** (aislamiento fuerte, datos personales de gobierno,
> Ley 1581) + **escala masiva agresiva** (miles de tenants). Arquitectura actual: `createNeonProject()`
> crea **un PROYECTO Neon por tenant** → el límite que muerde es **proyectos por cuenta**.
>
> ⚠️ Los números de abajo son **point-in-time** (confirmados 2026-07-12 desde docs.neon.com). Los
> precios y límites de Neon cambian — reconfirmar contra la consola y Neon-sales antes de comprometer.

---

## 1. Datos CONFIRMADOS hoy (fuente: neon.com/docs, 2026-07-12)

### 1.1. Límite de proyectos por cuenta (EL crítico) — `neon.com/docs/introduction/plans`
| Plan | Máx. proyectos/cuenta | Compute (autoscale) | Scale-to-zero | Precio compute | Storage |
|---|---|---|---|---|---|
| Free | **100** | hasta 2 CU | 5 min (no desactivable) | $0 | 0.5 GB/proy |
| Launch | **100** | hasta 16 CU | 5 min (desactivable) | $0.106/CU-h | $0.35/GB-mes |
| **Scale** | **1.000 (SOFT — "se sube a pedido")** | hasta 16 CU (fijo a 56) | configurable (1 min → always-on) | $0.222/CU-h | $0.35/GB-mes |
| Business/Enterprise | **no publicado** (soporte/plan a la medida, precio aparte) | — | — | — | — |

**🔴 Hallazgo #1 (el que define todo):** el techo por defecto es **1.000 proyectos por cuenta en el
plan Scale**, y es un **límite blando ("can be increased on request")**. Con 1 proyecto = 1 tenant,
**cualquier cosa por encima de ~1.000 tenants exige aprobación explícita de Neon + muy probablemente
un acuerdo Enterprise/a la medida.** Es decir: **la escala agresiva NO está garantizada por el plan
público — hay que negociarla con Neon.** Ese es el dato duro.

### 1.2. Conexiones — `neon.com/docs/connect/connection-pooling`
- **Directas (escalan con compute):** 0.25 CU = 104 · 1 CU = 419 · 4 CU = 1.678 · **cap 4.000** (9+ CU).
  (7 reservadas al superusuario Neon.)
- **PgBouncer (pooling):** hasta **10.000 conexiones cliente concurrentes**; `default_pool_size =
  0.9 × max_connections` por (usuario, base); timeout de cola de query = 120 s.
- **Implicación:** con miles de BDs no mantienes pools abiertos a todas. El ruteo de tenant debe
  abrir/cerrar contra el **pooler** por request y depender de scale-to-zero para los inactivos.

### 1.3. Otros límites confirmados
- Branches por proyecto: Free/Launch = 10 · Scale = 25.
- Egress incluido: Launch/Scale = 500 GB/mes; excedente se cobra.
- Scale-to-zero configurable en Scale (1 min → always-on) → **tenants inactivos ≈ $0 de compute.**

---

## 2. Preguntas ABIERTAS — solo tu cuenta / Neon-sales las responde (BLOQUEANTES)

Estas NO se pueden sacar de los docs públicos. Son la diferencia entre promesa y dato:

- [ ] **B1. ¿Hasta cuántos proyectos sube Neon el límite blando de 1.000?** ¿5k? ¿50k? ¿Hay un tope
  técnico real por cuenta/organización? → **Contactar Neon-sales con tu proyección de tenants.**
- [ ] **B2. ¿Precio real a tu escala?** ¿Descuentos por volumen? ¿Costo de un plan Enterprise para
  N miles de proyectos? (El público $0.222/CU-h + $0.35/GB-mes probablemente no aplica tal cual a
  10k+ proyectos.)
- [ ] **B3. Rate limits de la API de provisioning** (`createNeonProject`): ¿cuántos proyectos/minuto
  se pueden crear? Define si el aprovisionamiento debe ser en cola (casi seguro que sí).
- [ ] **B4. Latencia de "cold start" desde scale-to-zero.** Cuánto tarda un tenant inactivo en
  responder el primer request. Afecta UX del primer acceso del día. (Docs mencionan reanudación
  rápida, pero hay que **medirlo**, no asumirlo.)
- [ ] **B5. Backups/PITR por proyecto a escala:** ¿retención, costo y restauración por tenant?
- [ ] **B6. Organizaciones/cuentas:** ¿el límite es por cuenta o por organización? ¿Se puede repartir
  la flota en varias organizaciones para superar el techo? (Afecta el modelo del plano de control.)

---

## 3. Experimentos a CORRER (medir, no asumir)

Con una cuenta Scale (o trial Enterprise), automatizar y medir:

- [ ] **E1. Throughput de provisioning:** crear 50–100 proyectos vía API en bucle; medir tiempo/proyecto
  y errores/rate-limit. → dimensiona la cola de aprovisionamiento.
- [ ] **E2. Cold start real:** proyecto con scale-to-zero a 1 min; dejarlo dormir; medir latencia del
  primer request (p50/p95). Criterio: ¿< 1 s aceptable para el primer acceso del ciudadano/funcionario?
- [ ] **E3. Migración fan-out:** aplicar un cambio de schema (`ALTER TABLE ADD COLUMN`) a 50 proyectos
  en paralelo; medir tiempo total, fallos, y validar el patrón resumible/versionado. → valida el motor
  de **orquestación de migraciones** (el #1 del plano de control).
- [ ] **E4. Conexiones bajo carga:** simular N tenants activos concurrentes contra el pooler; confirmar
  que no se topa el ceiling de 10k ni el `default_pool_size`.

---

## 4. Modelo de costo a COMPLETAR (fórmula + inputs a confirmar)

`Costo/mes ≈ Σ_tenant [ (CU-horas_activas × $/CU-h) + (GB_storage × $/GB-mes) ] + egress`

Inputs a confirmar (B2) y estimar por tipo de entidad:
- CU-horas activas promedio por tenant/mes (depende de uso real; con scale-to-zero, los inactivos ≈ 0).
- GB de storage promedio por tenant (medir sobre Armenia real como referencia).
- % de tenants activos vs. dormidos.

**Ejemplo ilustrativo (NO comprometer sin B2):** 10.000 tenants, 0.5 GB c/u, 20% activos 2 CU-h/día:
storage ≈ 5.000 GB × $0.35 = **$1.750/mes** + compute de los activos. El storage domina cuando la
mayoría duerme — bueno para el modelo de negocio, pero **reconfirmar precio a escala (B2).**

---

## 5. Qué habilita esta verificación

- **Si B1 + B2 salen bien** (Neon sube el límite a tu escala a costo viable) → BD-por-tenant se queda,
  el stack se queda, y el trabajo se concentra en el **plano de control** (provisioning asíncrono +
  orquestación de migraciones + ruteo).
- **Si B1 topa** (Neon no sube más allá de X proyectos por cuenta a costo razonable) → NO se cambia de
  stack ni de decisión de aislamiento; se evalúa **repartir la flota en varias organizaciones/cuentas
  Neon** (B6) o un **tiering** (proyecto dedicado para grandes, agrupación para pequeños) — todo
  dentro de Postgres/Neon.

**Regla:** no se promete escala en una propuesta comercial hasta cerrar B1 y B2 con Neon por escrito.

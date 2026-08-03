# Interoperabilidad con el Estado colombiano — nota de referencia (futuro)

> **No es un plan activo.** Nota para tener presente cuándo y por qué activarlo. No bloquea el orden
> de construcción actual (Fundación → Portal Institucional → Financiero → …). Ver `REBUILD_bitacora.md`.

## De qué se trata

Para que Government One interopere **oficialmente** con otras entidades del Estado (Registraduría,
DIAN, Policía, Procuraduría, Superintendencias, RUNT, RUES…) no basta con consumir APIs públicas. Hay
que integrarse al ecosistema de Servicios Ciudadanos Digitales, que tiene 4 componentes (Marco de
Interoperabilidad de MinTIC / Agencia Nacional Digital — AND):

1. **Político-legal** — Ley 1712/2014 + Res. 1519/2020 (transparencia), Ley 1581/2012 (habeas data),
   Ley 527/1999 (firma electrónica), Decreto 620/2020 y Decreto 767/2022 (crean la AND).
2. **Organizacional** — cada entidad es dueña de sus datos; decide qué comparte y bajo qué convenio.
3. **Semántico** — vocabularios/catálogos comunes en vez de estructuras propias por entidad.
4. **Técnico** — **X-Road** como motor de intercambio, autenticación digital unificada, Carpeta
   Ciudadana Digital.

## Dónde está Government One hoy

Ya alineado sin buscarlo explícitamente, porque las reglas de oro del rebuild apuntan en la misma
dirección que exige el Estado:

- ✅ **Organizacional** — BD por tenant, aislamiento fuerte (regla de oro, ver `REBUILD_bitacora.md`).
- ✅ **Semántico** — catálogos nacionales (CCPET, CGC, festivos, Res. 1519, catálogo de módulos),
  cero hardcode de entidad (regla de oro #2).
- ✅ **Político-legal (parcial)** — Res. 1519/Transparencia contemplada en el Portal público
  (`PLAN_modulo_portal.md`, Paso D). Falta habeas data explícito y firma electrónica cuando se generen
  actos administrativos (respuestas PQRSD, resoluciones de contratación, etc.).
- ❌ **Técnico (X-Road)** — no existe. Es lo más pesado y **no es una decisión del desarrollador**:
  los certificados y la habilitación ante la AND son del tenant (la entidad pública), no de Government
  One. La entidad adquiere el software → solicita habilitación ante la AND → el software implementa
  el cliente X-Road → las credenciales quedan en cabeza de la entidad.

## Qué activaría esto

Ningún módulo del orden de construcción actual (Fundación, Portal/GD/VU, Financiero, Presupuesto,
Banco de proyectos, Contratación) requiere X-Road para funcionar. Se vuelve relevante cuando:

- Un tenant pida **validar identidad** contra Registraduría (cédula) en un trámite o registro de
  ciudadano.
- Se construya un módulo de **Trámites y Servicios** real (no solo PQRSD) que necesite consultar RUES,
  RUNT, antecedentes (Policía/Procuraduría), etc. — eso implicaría también registro en el **SUIT**
  (Sistema Único de Información de Trámites).
- Se generen actos administrativos que requieran **firma electrónica/digital** válida legalmente.

## Cómo construirlo cuando toque (para no tener que reescribir)

**Arquitectura de adaptadores**, no un cliente X-Road en el núcleo:

- Adaptador X-Road (motor de intercambio).
- Adaptador Carpeta Ciudadana Digital.
- Adaptador Autenticación Digital.
- Adaptadores puntuales por API (SECOP, DIAN, RUES…) según lo que cada tenant habilite.

Cada adaptador se activa **por tenant** (credenciales/certificados propios de la entidad, nunca
compartidos ni en cabeza de Government One). Requiere además: auditoría completa de cada consulta,
trazabilidad de quién consultó qué, y control de permisos por rol/capacidad — esto último ya existe
como patrón (`tieneCapacidad`, ver `FUNDACION_estructura_organizacional.md`), solo se extendería a las
consultas externas.

**Cuidado a tener presente hoy** (sin construir nada de más): al modelar identidad de ciudadano/
peticionario en Portal/GD/VU, no asumir que todo dato de una persona vive solo en la BD del tenant —
deja el modelo abierto a que, en el futuro, un campo se resuelva por una fuente externa en vez de un
valor guardado localmente. Es aplicar la regla de cero hardcode ya existente, no una abstracción nueva.

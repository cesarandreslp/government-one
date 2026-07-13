# Fundación de dominio: estructura organizacional + Cargo + vínculo + ruteo VU

> **La hoja que cierra el modelo antes de codear.** Todo lo demás (contratación, presupuesto,
> banco de proyectos, VU) cuelga de esto. Grounded en el código actual (verificado 2026-07-12).
>
> **Principio rector:** una persona tiene UNA identidad pero MUCHAS funciones. Las funciones no se
> modelan como roles — se modelan como **capacidades que confiere un CARGO**, y el cargo vive en el
> **árbol organizacional**. La asignación de trabajo va **al cargo**, no a la persona; se resuelve a
> quien lo ocupa hoy.

---

## 0. Qué YA existe (no se reinventa)

| Pieza | Estado actual | Qué le falta |
|---|---|---|
| **Árbol de dependencias** | `GdTrdDependencia` (jerárquico vía `padreId`, `codigo`, `nombre`, `activa`, `modulosCompetencia`) | `tipo` (nivel), flag de servicio compartido, micrositio |
| **Cargo** | ❌ NO existe como entidad. `Usuario.cargo` es **texto libre** | crear entidad `Cargo` estructurada |
| **Capacidades por módulo** | `accesos.ts` → `CAPACIDADES_POR_MODULO` (contratacion: elaborar/supervisar/aprobar; presupuesto: expedir_cdp/rp/aprobar; …) | reusar tal cual — ya está bien |
| **Plantillas de cargo** | `PLANTILLAS_CARGO` (catálogo hardcoded, match por substring de texto) | volverlo **semilla** de cargos reales por tipo de entidad |
| **Acceso por usuario** | `Usuario.modulosAsignados` (grants por persona) | pasar a **cargo como fuente primaria**; persona = override opcional |
| **Vínculo persona↔cargo** | implícito y frágil (texto `cargo` + `dependenciaId`) | entidad de vínculo con vigencia temporal |

---

## 1. Los cuatro elementos de la fundación

### 1.1. `Dependencia` (árbol) — evoluciona `GdTrdDependencia`
- Árbol de profundidad arbitraria: **Secretaría → Subsecretaría → Dirección → Oficina** (ya soportado por `padreId`).
- Nuevo `tipo` (opcional, informativo): `SECRETARIA | SUBSECRETARIA | DIRECCION | OFICINA | DESPACHO`.
- Nuevo flag **`esServicioCompartido: Boolean`** → marca las dependencias **transversales** (Jurídica,
  Contratación) que prestan servicio a TODAS las secretarías, no solo a la suya.
- Micrositio: campos de contenido del micrositio por dependencia (o relación a un `Micrositio`).

### 1.2. `Cargo` (NUEVO — entidad estructurada) — reemplaza `Usuario.cargo` texto libre
```
Cargo {
  id
  dependenciaId   -> Dependencia      // el cargo VIVE en una dependencia del árbol
  nombre          // "Profesional de Contratación", "Jefe de Oficina Jurídica"
  esJefatura      Boolean             // ¿es el cargo cabeza de la dependencia? (para fallback de ruteo)
  grants          Json                // { moduloId: capacidad[] }  ← el BUNDLE que confiere el cargo
  activo          Boolean
}
```
- El `grants` del cargo usa **exactamente** el formato `GrantsUsuario` que ya existe (`{moduloId:
  capacidad[]}`) y las capacidades ya definidas en `CAPACIDADES_POR_MODULO`.
- `PLANTILLAS_CARGO` + `PLANTILLA_ALCALDIA` se convierten en la **semilla** que crea los cargos de una
  entidad al implementar el Portal (plantillas por tipo de entidad — el activo comercial).

### 1.3. Vínculo persona↔cargo — `VinculacionCargo` (NUEVO)
```
VinculacionCargo {
  id
  usuarioId  -> Usuario
  cargoId    -> Cargo
  tipo       TITULAR | ENCARGADO | PROVISIONAL   // encargo cubre ausencias; PROVISIONAL = por
                                                 // resolución/decreto hasta que un concurso de méritos provea el cargo
  actoAdmin  String?                             // resolución/decreto que soporta el nombramiento (encargo/provisional)
  desde      DateTime
  hasta      DateTime?                     // null = vigente
  vigente    Boolean                       // derivado (hasta == null || hasta > now)
}
```
- **Funciona con y sin módulo de RRHH:** sin RRHH, se crea el vínculo a mano (quién ocupa el cargo);
  con RRHH, el ciclo (nombramientos, encargos, vacancias) administra estos vínculos automáticamente.
- **Auditabilidad temporal (blind spot del consejo):** `desde/hasta` dan el **snapshot histórico** —
  se puede reconstruir *quién tenía qué autoridad en el momento T*, requisito de control fiscal (Ley 80).

**Cargos MÚLTIPLES concurrentes y ENCARGOS (confirmado por el usuario — caso real):**
- Una persona puede tener **varios vínculos vigentes a la vez**: su cargo `TITULAR` + uno o más
  `ENCARGADO` temporales, **sin dejar el propio**. Ej.: un secretario nombrado temporalmente en otra
  secretaría mientras el titular está de vacaciones; o un funcionario normal encargado de una jefatura
  sin perder su cargo base.
- **Capacidades efectivas = UNIÓN** de los grants de todos los cargos con vínculo vigente (el encargo
  SUMA la autoridad de la jefatura mientras dura; el cargo base se conserva).
- **Regla de resolución "¿quién EJERCE el cargo HOY?"** (para ruteo VU, aprobaciones, "cabeza de la
  dependencia") — evita rutear al titular ausente:
  1. `ENCARGADO` con vínculo vigente → ese.
  2. si no, `TITULAR` **sin ausencia vigente** → ese.
  3. si no (titular ausente y sin encargado) → cargo sin quién lo ejerza → fallback (cargo `esJefatura`
     superior / dependencia).
- **`Ausencia` (vacaciones/licencia/comisión/incapacidad)** — enriquecimiento de **RRHH**, NO del núcleo:
  ```
  Ausencia { usuarioId -> Usuario, tipo, desde, hasta, motivo? }
  ```
  - **Sin RRHH (núcleo):** basta el encargo; regla: el `ENCARGADO` vigente **precede** al `TITULAR` para
    "quién ejerce". Funciona sin `Ausencia`.
  - **Con RRHH (enriquecido):** la `Ausencia` explica y acota el hueco, dispara el encargo y da la
    precisión de auditoría ("el día T el titular estaba en vacaciones; ejercía el encargado X").

### 1.4. Ruteo de Ventanilla Única **por cargo**
- Hoy: la reasignación asigna a **persona** y mueve `gdRadicado.dependenciaId`; el ruteo IA
  (`AIAssignmentService`, latente) rutea por `cargo` **texto**.
- Nuevo: el ruteo (IA o reglas) recomienda un **`Cargo`** (estructurado, en su dependencia) y **resuelve
  al/los funcionario(s) con vínculo vigente a ese cargo**. Fallbacks en orden: cargo específico →
  cargo `esJefatura` de la dependencia → dependencia de servicio compartido correspondiente.
- Al cablearlo: usar la **key IA por-tenant** (el `AIAssignmentService` actual usa la de plataforma →
  [[regla-oro-credenciales-por-tenant]], corregir al portar).

---

## 2. Cómo se resuelve el ACCESO (la composición)

```
capacidades_efectivas(persona) =
      Σ  grants(cargo)   para cada cargo con VinculacionCargo VIGENTE de la persona
   (∪  Usuario.modulosAsignados  como override/excepción individual, opcional)
```
- **El cargo es la fuente primaria** de acceso (lo decidido: asignar al cargo, no a la persona).
- `Usuario.modulosAsignados` se conserva solo como **override puntual** (una capacidad extra a una
  persona sin cambiarle el cargo). No es lo normal.
- Roles (`Usuario.role`) quedan reducidos a **identidad/nivel de plataforma**: `SUPER_ADMIN`, `ADMIN`
  (administran el tenant), `USER`/`FUNCIONARIO` (identidad genérica), `CONTRATISTA` (identidad externa,
  portal). **NO** roles por función.

## 3. Cómo mapea la decisión roles→capacidades (cierra el hilo anterior)

Los pseudo-roles del ciclo contractual **dejan de ser roles** y pasan a ser capacidades del módulo
`contratacion` — que **ya existen** en `CAPACIDADES_POR_MODULO`:

| Antes (rol) | Ahora (capacidad de `contratacion`, vía cargo) |
|---|---|
| ESTRUCTURADOR | `elaborar` (cargo de estructuración en cada secretaría — **distribuido**) |
| ABOGADO | `revisar_juridica` (cargo en la dependencia Jurídica — **servicio compartido**) |
| JEFE_JURIDICO | `concepto_juridico` (cargo jefatura de Jurídica — **servicio compartido**) |
| SUPERVISOR | `supervisar` (ya existe) |

- La gating de **quién actúa en un contrato ESPECÍFICO** se queda en las **FK por-contrato**
  (`estructuradorId`, `abogadoAsignadoId`) **+** la capacidad del cargo. `puedeAvanzarContrato()` deja
  de mirar `role` y mira: *¿tiene la capacidad (vía cargo) **Y** está asignado a ESTE contrato?*
- `CONTRATISTA` sigue siendo identidad (rol), no capacidad.

## 4. Servicios compartidos (lo que destrabó tu ejemplo de Buga)

- **Distribuido** (cada secretaría lo hace): estructurar contratos, responder PQRS de su área,
  reportar ejecución de sus proyectos → cargos en cada dependencia con las capacidades.
- **Concentrado / servicio compartido** (`esServicioCompartido=true`): Jurídica (perfecciona contratos
  de TODAS), Contratación (consecutivos de TODAS), Hacienda (la plata de todas), Planeación (mide la
  ejecución de todas) → cargos en esas dependencias transversales.

---

## 5. Qué se conserva vs. qué cambia

**Se conserva:** el árbol `GdTrdDependencia`, el formato de grants `{modulo: capacidad[]}`,
`CAPACIDADES_POR_MODULO`, las FK por-contrato, el flujo VU vivo.
**Cambia:** `Usuario.cargo` texto → entidad `Cargo`; acceso primario pasa de `modulosAsignados`
(persona) a `Cargo.grants` (cargo) + `VinculacionCargo`; ruteo VU pasa a resolver por cargo;
`puedeAvanzarContrato` deja de mirar `role`.

## 6. Preguntas abiertas (mínimas, para cerrar en implementación)
- [ ] ¿`Usuario.cargo` texto se **migra** a `Cargo`+`VinculacionCargo` o se deja legacy y se puebla nuevo?
      (En el rebuild: nace `Cargo` desde cero; en Armenia migrada, script de migración.)
- [ ] Nombres finales de las capacidades nuevas de contratación (`revisar_juridica`/`concepto_juridico`)
      — agregarlas a `CAPACIDADES_POR_MODULO[contratacion]`.
- [ ] ¿Micrositio de dependencia = campos en `Dependencia` o entidad `Micrositio` aparte? (probable: aparte).

## 7. Identidades externas: contratistas, supervisión e interventoría

- **Contratista = identidad EXTERNA** (rol `CONTRATISTA`). **NO ocupa cargo ni vive en el árbol de
  dependencias.** Su alcance lo definen **sus contratos**, no una dependencia.
- Un contratista puede tener **N contratos** — en la misma dependencia o en varias.
- Un **contrato puede financiarse con recursos de VARIAS dependencias** (CDP/proyectos de distintas
  secretarías; ya soportado por la tabla puente `ConContratoProyecto` + presupuesto), y abarcar
  actividades de varias competencias — pero tiene **UN solo supervisor**. Ej.: contratista de avisos y
  tableros (Planeación) + espacio público (Gobierno) = un contrato multi-competencia/multi-financiación,
  supervisor único.
### Vigilancia del contrato — 4 figuras separadas (Ley 1474/2011, confirmado)

1. **Contratista ejecutor** — ejecuta el objeto del contrato; reporta ejecución.
2. **Supervisor** — **servidor público interno** (funcionario en un cargo), autoridad de vigilancia.
   **Un contratista NUNCA puede ser supervisor.** → `supervisar` es capacidad de **cargo funcionario**;
   `ConContrato.supervisorId` **valida** que apunta a un funcionario, no a un `CONTRATISTA`.
3. **Interventor** — **tercero externo CONTRATADO** (persona natural/jurídica) para seguimiento
   especializado; también tiene autoridad de vigilancia, pero es externo. **La interventoría es su
   PROPIO contrato** (otro `ConContrato`, tipo interventoría/consultoría), cuyo `contratistaUsuarioId`
   es el interventor. → un contrato **vigila** a otro. Caso real: concesión de alumbrado público con
   interventora asignada por la duración de la concesión.
4. **Apoyo a la supervisión** — un contratista contratado con ese objeto; **asiste** al supervisor
   interno pero **NO** tiene autoridad ni la capacidad `supervisar`.

**Regla legal:** supervisión e interventoría **por regla general NO concurren** sobre el mismo contrato
(una **o** la otra; la entidad puede dividirlas en casos puntuales). Modelo:
```
ConContrato {
  ...
  modalidadVigilancia   SUPERVISION | INTERVENTORIA      // excluyentes por regla general
  supervisorId          -> Usuario?    // solo SUPERVISION; validado = funcionario, no contratista
  interventoriaContratoId -> ConContrato?  // solo INTERVENTORIA; apunta al contrato de interventoría
}
```
- **¿Quién aprueba los informes de ejecución?** SUPERVISION → el funcionario supervisor; INTERVENTORIA →
  el interventor (contratista del contrato de interventoría), dentro de su alcance.

---

**Estado:** modelo de dominio CERRADO a nivel conceptual sobre terreno verificado. Falta la otra mitad
de la fundación (**plano de control**: provisioning asíncrono + orquestación de migraciones + ruteo de
tenant) — documento aparte. Con ambas hojas cerradas, arranca el rebuild: fundación primero, luego
módulo por módulo verificado en vivo.

import type { PrismaClient } from "@/generated/tenant/client"
import type { Grants } from "./capacidades"

// PLANTILLAS por TIPO de entidad (ALCALDIA, PERSONERIA, …) — el activo comercial.
// NO son datos de una entidad concreta (eso violaría "cero hardcode de entidad"): son
// catálogos por *tipo*, generic y EDITABLES una vez sembrados en el tenant. Al implementar
// el Portal de una entidad, esta plantilla siembra su árbol de dependencias + cargos (con
// sus grants), que luego la entidad ajusta a su estructura real.

export type DepTipo = "DESPACHO" | "SECRETARIA" | "SUBSECRETARIA" | "DIRECCION" | "OFICINA"

export interface PlantillaCargo {
  nombre: string
  esJefatura?: boolean
  grants?: Grants
  /** Código del catálogo `EMPLEOS_DAFP` (ver empleos-dafp.ts). Sin definir = elección/período fijo. */
  empleoCodigo?: string
  /** Funciones/responsabilidad específica de este cargo (manual de funciones), texto libre. */
  funciones?: string
}

export interface PlantillaDependencia {
  codigo: string
  nombre: string
  tipo: DepTipo
  /** Transversal: presta servicio a TODAS las dependencias (Jurídica, Contratación, Hacienda…). */
  esServicioCompartido?: boolean
  /** Código de la dependencia padre en esta misma plantilla (jerarquía). */
  padreCodigo?: string
  cargos: PlantillaCargo[]
}

export interface PlantillaEntidad {
  tipoEntidad: string
  nombre: string
  dependencias: PlantillaDependencia[]
}

// ── ALCALDÍA ──────────────────────────────────────────────────────────────────────────
const ALCALDIA: PlantillaEntidad = {
  tipoEntidad: "ALCALDIA",
  nombre: "Alcaldía municipal",
  dependencias: [
    {
      codigo: "DESP", nombre: "Despacho del Alcalde", tipo: "DESPACHO",
      cargos: [
        { nombre: "Alcalde", esJefatura: true, grants: { contratacion: ["aprobar"], presupuesto: ["aprobar"] } },
      ],
    },
    {
      codigo: "JUR", nombre: "Oficina Jurídica", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Jefe de Oficina Jurídica", esJefatura: true, empleoCodigo: "115-01",
          grants: { contratacion: ["concepto_juridico", "revisar_juridica"], gestion_disciplinaria: ["consultar", "gestionar"] },
          funciones: "Dirigir la oficina jurídica; conceptuar y revisar jurídicamente los procesos contractuales y actos administrativos de la entidad; tramitar los procesos disciplinarios internos (según el comparativo, la gestión disciplinaria suele depender de Jurídica y no de Talento Humano)." },
        { nombre: "Profesional Jurídico", empleoCodigo: "222-02", grants: { contratacion: ["revisar_juridica"] },
          funciones: "Revisión jurídica de contratos y actos administrativos." },
      ],
    },
    {
      codigo: "CONT", nombre: "Oficina de Contratación", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Jefe de Contratación", esJefatura: true, empleoCodigo: "068-01", grants: { contratacion: ["elaborar", "aprobar"] },
          funciones: "Dirigir el proceso de contratación de la entidad; aprobar la estructuración de contratos." },
        { nombre: "Profesional de Contratación", empleoCodigo: "219-02", grants: { contratacion: ["elaborar"] },
          funciones: "Estructurar y hacer seguimiento a los procesos contractuales." },
      ],
    },
    {
      codigo: "ATC", nombre: "Atención al Ciudadano — Ventanilla Única", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Responsable de Ventanilla Única", esJefatura: true, empleoCodigo: "367-02", grants: { ventanilla_unica: ["radicar", "asignar", "supervisar"], gestion_documental: ["radicar", "archivar", "administrar_trd"] },
          funciones: "Coordinar la recepción, radicación y asignación de PQRSD y correspondencia." },
        { nombre: "Auxiliar de Ventanilla", empleoCodigo: "407-01", grants: { ventanilla_unica: ["radicar"], gestion_documental: ["radicar"] },
          funciones: "Radicar correspondencia y PQRSD de atención al ciudadano." },
      ],
    },
    {
      // Cargos diferenciados (mismo criterio que Hacienda): la Administración de Personal
      // (vinculación/actos administrativos) y la Nómina (liquidación salarial) son procesos
      // separados en toda entidad territorial real — la Nómina es, según el comparativo, "uno
      // de los procesos más críticos" y merece su propio responsable, no el mismo que vincula
      // funcionarios. El jefe supervisa ambos (consulta) sin operar el detalle de nómina.
      codigo: "TH", nombre: "Oficina de Talento Humano", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Jefe de Talento Humano", esJefatura: true, empleoCodigo: "068-01",
          grants: {
            gestion_humana: ["gestionar_funcionarios", "actos_administrativos", "consultar"],
            nomina: ["consultar"],
            evaluacion_desempeno: ["consultar"], sst: ["consultar"], capacitacion: ["consultar"],
            bienestar: ["consultar"], relaciones_laborales: ["consultar"],
          },
          funciones: "Dirigir la gestión del talento humano: vinculación, actos administrativos y bienestar; supervisar la liquidación de nómina y los demás procesos de la oficina." },
        { nombre: "Profesional de Talento Humano", empleoCodigo: "219-02",
          grants: {
            gestion_humana: ["gestionar_funcionarios", "actos_administrativos", "consultar"],
            evaluacion_desempeno: ["consultar", "evaluar"], sst: ["consultar", "administrar"],
            capacitacion: ["consultar", "administrar"], bienestar: ["consultar", "administrar"],
            relaciones_laborales: ["consultar", "administrar"],
          },
          funciones: "Gestionar la vinculación de funcionarios, actos administrativos, evaluación del desempeño, SST, capacitación, bienestar y relaciones laborales — oficina pequeña, un solo profesional coordina los procesos misionales de talento humano (la nómina queda separada, ver cargo siguiente)." },
        { nombre: "Profesional de Nómina", empleoCodigo: "222-01", grants: { nomina: ["consultar", "liquidar", "pagar"] },
          funciones: "Liquidar la nómina mensual, generar la PILA y pagar los pasivos a EPS/AFP/ARL/caja — separado de quien gestiona la vinculación." },
      ],
    },
    {
      // Cargos diferenciados por sub-área (no todos los funcionarios de Hacienda tocan los
      // mismos módulos): el secretario SUPERVISA (consulta transversal + aprueba presupuesto,
      // no opera el detalle); cada profesional tiene UN módulo propio; el tesorero es la única
      // excepción con 2 (tesorería completa + quien recibe el recaudo de rentas — separación de
      // funciones real: quien LIQUIDA el impuesto no es quien lo COBRA).
      codigo: "HAC", nombre: "Secretaría de Hacienda", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Hacienda", esJefatura: true, empleoCodigo: "020-01",
          grants: { presupuesto: ["aprobar"], contabilidad: ["consultar"], tesoreria: ["consultar"], rentas: ["consultar"], cobro_coactivo: ["consultar"], ventanilla_unica: ["responder"] },
          funciones: "Dirigir la Secretaría de Hacienda; aprobar el presupuesto y supervisar la ejecución financiera de todas sus sub-áreas." },
        { nombre: "Profesional de Presupuesto", empleoCodigo: "222-02", grants: { presupuesto: ["consultar", "expedir_cdp", "expedir_rp"] },
          funciones: "Expedir y hacer seguimiento a CDP y RP; controlar la ejecución presupuestal." },
        { nombre: "Profesional de Contabilidad", empleoCodigo: "222-02", grants: { contabilidad: ["consultar", "registrar", "administrar"] },
          funciones: "Registrar comprobantes contables y administrar el plan de cuentas, periodos y terceros." },
        { nombre: "Tesorero", empleoCodigo: "222-01", grants: { tesoreria: ["consultar", "administrar", "conciliar"], rentas: ["recaudar"], cobro_coactivo: ["recaudar"] },
          funciones: "Administrar las cuentas bancarias, registrar movimientos y conciliar extractos; recibir el pago de las liquidaciones de rentas y de las cuotas de cobro coactivo." },
        { nombre: "Profesional de Rentas", empleoCodigo: "222-02", grants: { rentas: ["consultar", "administrar", "liquidar"] },
          funciones: "Liquidar el impuesto predial e ICA: registrar predios, establecimientos, actividades económicas y tarifas por vigencia." },
        { nombre: "Profesional de Cobro Coactivo", empleoCodigo: "222-01", grants: { cobro_coactivo: ["consultar", "gestionar"] },
          funciones: "Gestionar los procesos de cobro coactivo sobre la cartera vencida: mandamientos de pago, medidas cautelares y acuerdos de pago." },
      ],
    },
    {
      // Estructura real de una Secretaría de Planeación grande (corrección del usuario,
      // 2026-07-27): a diferencia de Hacienda/TH (cargos diferenciados pero FLAT en una sola
      // dependencia), Planeación se modela con sub-dependencias reales — cada oficina/área tiene
      // su propio código y su propio `modulos` (Capa 2), no todas comparten el array de PLAN.
      codigo: "PLAN", nombre: "Secretaría de Planeación", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Planeación", esJefatura: true, empleoCodigo: "020-01",
          grants: { ventanilla_unica: ["responder"], ordenamiento_territorial: ["consultar"], pdm: ["consultar"], estratificacion: ["consultar"], sisben: ["consultar"], banco_proyectos: ["consultar"] } },
      ],
    },
    {
      codigo: "PLAN-SECEJEC", nombre: "Secretaría del Secretario de Planeación", tipo: "OFICINA", padreCodigo: "PLAN",
      cargos: [
        { nombre: "Secretario Ejecutivo — Despacho de Planeación", empleoCodigo: "425-01",
          funciones: "Agenda, correspondencia y apoyo administrativo al despacho del Secretario de Planeación." },
      ],
    },
    {
      codigo: "PLAN-VU", nombre: "Ventanilla Única — Secretaría de Planeación", tipo: "OFICINA", padreCodigo: "PLAN",
      cargos: [
        { nombre: "Auxiliar de Ventanilla — Planeación", empleoCodigo: "407-01", grants: { ventanilla_unica: ["radicar"] },
          funciones: "Radicar trámites, solicitudes y PQRSD dirigidos a la Secretaría de Planeación." },
      ],
    },
    {
      codigo: "PLAN-CONT", nombre: "Contratación — Planeación", tipo: "OFICINA", padreCodigo: "PLAN",
      cargos: [
        { nombre: "Profesional de Contratación — Planeación", empleoCodigo: "219-02", grants: { contratacion: ["elaborar"] },
          funciones: "Estructurar y hacer seguimiento a los procesos contractuales de la Secretaría de Planeación." },
      ],
    },
    {
      codigo: "PLAN-ALUM", nombre: "Alumbrado Público", tipo: "OFICINA", padreCodigo: "PLAN",
      cargos: [
        { nombre: "Profesional de Alumbrado Público", empleoCodigo: "222-01",
          funciones: "Administrar y supervisar el servicio de alumbrado público municipal (contrato de concesión u operación, expansión y mantenimiento)." },
      ],
    },
    {
      codigo: "PLAN-ESTRAT", nombre: "Estratificación", tipo: "OFICINA", padreCodigo: "PLAN",
      cargos: [
        { nombre: "Técnico Administrativo — Estratificación y SISBEN", empleoCodigo: "367-02",
          grants: { estratificacion: ["consultar", "actualizar"], sisben: ["consultar", "administrar"] },
          funciones: "Actualizar y hacer seguimiento a la estratificación socioeconómica del municipio; administrar el registro local de fichas SISBEN a partir de los cargues del DNP." },
      ],
    },
    {
      // COTE (no "COME"): el nombre municipal-específico no aplica — la plataforma sirve
      // alcaldías, personerías y otros tipos de entidad territorial, no solo municipios.
      codigo: "PLAN-COME", nombre: "COTE — Comité Territorial de Estadística", tipo: "OFICINA", padreCodigo: "PLAN",
      cargos: [
        { nombre: "Profesional COTE", empleoCodigo: "219-02",
          funciones: "Coordinar el Comité Territorial de Estadística (COTE), fuente oficial de información estadística de la entidad." },
      ],
    },
    {
      // esServicioCompartido: hace seguimiento financiero/físico al PDM de TODAS las dependencias
      // (ver funciones abajo) — misma naturaleza transversal que Jurídica/Contratación central.
      codigo: "PLAN-BP", nombre: "Banco de Proyectos", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "PLAN",
      cargos: [
        { nombre: "Profesional Especializado — Banco de Proyectos y Plan de Desarrollo", empleoCodigo: "222-02",
          grants: { banco_proyectos: ["administrar", "reportar_avance", "consultar"], pdm: ["administrar", "reportar_avance", "consultar"] },
          funciones: "Liderar el banco de proyectos y el seguimiento financiero y físico al cumplimiento del Plan de Desarrollo de todas las dependencias." },
      ],
    },
    {
      codigo: "PLAN-MIPG", nombre: "MIPG — Calidad", tipo: "OFICINA", padreCodigo: "PLAN",
      cargos: [
        { nombre: "Profesional MIPG", empleoCodigo: "222-01",
          funciones: "Administrar el Modelo Integrado de Planeación y Gestión (MIPG) y reportar el FURAG (Formulario Único de Reporte de Avance de la Gestión) ante el DAFP." },
      ],
    },
    {
      codigo: "PLAN-ORDFIS", nombre: "Ordenamiento Físico y Territorial", tipo: "OFICINA", padreCodigo: "PLAN",
      cargos: [
        { nombre: "Técnico Operativo — Ordenamiento Físico y Territorial", empleoCodigo: "314-02",
          grants: { ventanilla_unica: ["responder"], ordenamiento_territorial: ["consultar", "tramitar"] },
          funciones: "Atender trámites y consultas de ordenamiento territorial: línea de paramento, uso de suelo, licencias urbanísticas y demás asuntos del POT vigente." },
      ],
    },
    {
      codigo: "PLAN-AVISOS", nombre: "Avisos y Tableros", tipo: "OFICINA", padreCodigo: "PLAN-ORDFIS",
      cargos: [
        { nombre: "Técnico Operativo — Avisos y Tableros", empleoCodigo: "314-01", grants: { ventanilla_unica: ["responder"] },
          funciones: "Trámite de permisos de publicidad exterior visual: avisos, vallas y tableros (Ley 140/1994)." },
      ],
    },
    {
      codigo: "PLAN-ESPACIO", nombre: "Espacio Público", tipo: "OFICINA", padreCodigo: "PLAN-ORDFIS",
      cargos: [
        { nombre: "Técnico Operativo — Espacio Público", empleoCodigo: "314-01", grants: { ventanilla_unica: ["responder"] },
          funciones: "Administración, control y recuperación del espacio público municipal." },
      ],
    },
    {
      codigo: "GOB", nombre: "Secretaría de Gobierno", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Gobierno", esJefatura: true, empleoCodigo: "020-01", grants: { contratacion: ["elaborar"], ventanilla_unica: ["responder"] } },
      ],
    },
    // Sub-dependencias de Gobierno: estructura + conexión a Ventanilla Única. Investigado (no
    // descrito por el usuario): son las áreas casi universales de una Secretaría de Gobierno
    // municipal en Colombia (Ley 1801/2016, Ley 1098/2006 + Ley 2126/2021, Ley 1523/2012,
    // Ley 1448/2011, Ley 743/2002).
    // GOB-COMFAM (Comisaría de Familia) y GOB-INSPOL (Inspección de Policía): decisión del
    // usuario (2026-08-03) — esto es DEFINITIVO, no scaffolding a la espera de su turno. La
    // gestión real de casos vive en un sistema externo (GEFA), así que aquí solo responden
    // PQRSD. No construir módulo transaccional propio para estas dos. Las otras 4 sí siguen
    // abiertas a módulo propio cuando les toque el turno.
    {
      codigo: "GOB-COMFAM", nombre: "Comisaría de Familia", tipo: "OFICINA", padreCodigo: "GOB",
      cargos: [
        { nombre: "Comisario de Familia", empleoCodigo: "222-02", grants: { ventanilla_unica: ["responder"] },
          funciones: "Prevenir, proteger, restablecer y reparar los derechos de miembros de la familia víctimas de violencia intrafamiliar y de niños, niñas y adolescentes en riesgo (Ley 294/1996, Ley 1098/2006, Ley 2126/2021)." },
      ],
    },
    {
      codigo: "GOB-INSPOL", nombre: "Inspección de Policía", tipo: "OFICINA", padreCodigo: "GOB",
      cargos: [
        { nombre: "Inspector de Policía", empleoCodigo: "222-02", grants: { ventanilla_unica: ["responder"] },
          funciones: "Conocer querellas de policía, imponer medidas correctivas y tramitar comparendos del Código Nacional de Policía y Convivencia (Ley 1801/2016)." },
      ],
    },
    {
      codigo: "GOB-CONVIV", nombre: "Convivencia y Seguridad Ciudadana", tipo: "OFICINA", padreCodigo: "GOB",
      cargos: [
        { nombre: "Profesional de Convivencia y Seguridad Ciudadana", empleoCodigo: "219-02", grants: { ventanilla_unica: ["responder"], convivencia_seguridad: ["consultar", "administrar"] },
          funciones: "Articular con la Fuerza Pública el orden público municipal y hacer seguimiento al Plan Integral de Seguridad y Convivencia Ciudadana (PISCC)." },
      ],
    },
    {
      codigo: "GOB-PART", nombre: "Participación Ciudadana y Acción Comunal", tipo: "OFICINA", padreCodigo: "GOB",
      cargos: [
        { nombre: "Profesional de Participación Ciudadana", empleoCodigo: "219-02", grants: { ventanilla_unica: ["responder"], participacion_ciudadana: ["consultar", "administrar"] },
          funciones: "Fomentar la participación comunitaria y acompañar a las Juntas de Acción Comunal (Ley 743/2002)." },
      ],
    },
    {
      codigo: "GOB-VICT", nombre: "Enlace de Víctimas", tipo: "OFICINA", padreCodigo: "GOB",
      cargos: [
        { nombre: "Profesional Enlace de Víctimas", empleoCodigo: "219-02", grants: { ventanilla_unica: ["responder"], enlace_victimas: ["consultar", "administrar"] },
          funciones: "Atender, asistir y hacer seguimiento a la reparación integral de víctimas del conflicto armado (Ley 1448/2011) y al Plan de Acción Territorial (PAT)." },
      ],
    },
    {
      codigo: "GOB-GRD", nombre: "Gestión del Riesgo de Desastres", tipo: "OFICINA", padreCodigo: "GOB",
      cargos: [
        { nombre: "Profesional de Gestión del Riesgo", empleoCodigo: "219-02", grants: { ventanilla_unica: ["responder"], gestion_riesgo: ["consultar", "administrar"] },
          funciones: "Coordinar el Consejo Municipal de Gestión del Riesgo de Desastres (CMGRD): conocimiento y reducción del riesgo, y manejo de emergencias/desastres (Ley 1523/2012)." },
      ],
    },
    {
      codigo: "BS", nombre: "Secretaría de Bienestar Social", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Bienestar Social", esJefatura: true, empleoCodigo: "020-01", grants: { ventanilla_unica: ["responder"] } },
        { nombre: "Técnico Operativo — Adulto Mayor", empleoCodigo: "314-01",
          grants: { ventanilla_unica: ["responder"] },
          funciones: "Atender trámites y solicitudes del programa de adulto mayor: subsidios de Colombia Mayor, afiliación y novedades de beneficiarios." },
      ],
    },
  ],
}

// ── PERSONERÍA ────────────────────────────────────────────────────────────────────────
const PERSONERIA: PlantillaEntidad = {
  tipoEntidad: "PERSONERIA",
  nombre: "Personería municipal",
  dependencias: [
    {
      codigo: "DESP", nombre: "Despacho del Personero", tipo: "DESPACHO",
      cargos: [
        { nombre: "Personero Municipal", esJefatura: true, grants: { contratacion: ["aprobar", "elaborar"], presupuesto: ["aprobar"], ventanilla_unica: ["responder", "supervisar"] } },
      ],
    },
    {
      codigo: "ATC", nombre: "Atención al Ciudadano — Ventanilla Única", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Responsable de Ventanilla Única", esJefatura: true, empleoCodigo: "367-02", grants: { ventanilla_unica: ["radicar", "asignar"], gestion_documental: ["radicar", "archivar", "administrar_trd"] },
          funciones: "Coordinar la recepción, radicación y asignación de PQRSD y correspondencia." },
      ],
    },
    {
      codigo: "TH", nombre: "Talento Humano", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Profesional de Talento Humano", empleoCodigo: "219-02",
          grants: {
            gestion_humana: ["gestionar_funcionarios", "actos_administrativos", "consultar"],
            evaluacion_desempeno: ["consultar", "evaluar"], sst: ["consultar", "administrar"],
            capacitacion: ["consultar", "administrar"], bienestar: ["consultar", "administrar"],
            relaciones_laborales: ["consultar", "administrar"],
          },
          funciones: "Gestionar la vinculación de funcionarios, actos administrativos, evaluación del desempeño, SST, capacitación, bienestar y relaciones laborales." },
        { nombre: "Profesional de Nómina", empleoCodigo: "222-01", grants: { nomina: ["consultar", "liquidar", "pagar"] },
          funciones: "Liquidar la nómina mensual, generar la PILA y pagar los pasivos a EPS/AFP/ARL/caja — separado de quien gestiona la vinculación." },
      ],
    },
    {
      codigo: "DELEG", nombre: "Personería Delegada", tipo: "OFICINA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Personero Delegado", esJefatura: true, empleoCodigo: "222-02",
          grants: { ventanilla_unica: ["responder"], gestion_disciplinaria: ["consultar", "gestionar"] },
          funciones: "Ejercer las funciones delegadas por el Personero Municipal en materia de derechos humanos y ministerio público, incluida la gestión disciplinaria interna de la entidad." },
        { nombre: "Profesional Universitario", empleoCodigo: "219-01", grants: { ventanilla_unica: ["responder"], gestion_documental: ["consultar"] },
          funciones: "Apoyar las funciones misionales de la Personería Delegada." },
      ],
    },
  ],
}

export const PLANTILLAS_POR_TIPO: Record<string, PlantillaEntidad> = {
  ALCALDIA,
  PERSONERIA,
}

/** ¿Existe plantilla para este tipo de entidad? */
export function hayPlantilla(tipoEntidad: string): boolean {
  return tipoEntidad in PLANTILLAS_POR_TIPO
}

/** Ordena las dependencias de modo que cada padre venga antes que sus hijas (topológico). */
function ordenarPorJerarquia(deps: PlantillaDependencia[]): PlantillaDependencia[] {
  const out: PlantillaDependencia[] = []
  const puestas = new Set<string>()
  let restantes = [...deps]
  while (restantes.length) {
    const listas = restantes.filter((d) => !d.padreCodigo || puestas.has(d.padreCodigo))
    if (listas.length === 0) {
      // Padre inexistente en la plantilla: se agregan como raíces para no bloquear.
      out.push(...restantes)
      break
    }
    for (const d of listas) {
      out.push(d)
      puestas.add(d.codigo)
    }
    restantes = restantes.filter((d) => !puestas.has(d.codigo))
  }
  return out
}

export type SembradorDB = Pick<PrismaClient, "dependencia" | "cargo" | "empleoDafp">

/**
 * Siembra en la BD del tenant el árbol de dependencias + cargos de la plantilla del tipo de
 * entidad. Idempotente: las dependencias por `codigo` y los cargos por (dependencia, nombre)
 * se upsertean, así re-aplicarla no duplica. Devuelve cuántas dependencias/cargos quedaron.
 * Requiere que `sembrarEmpleosDafp` ya haya corrido (resuelve `empleoCodigo` → `empleoId`/`nivel`).
 */
export async function aplicarPlantilla(
  db: SembradorDB,
  tipoEntidad: string,
): Promise<{ dependencias: number; cargos: number }> {
  const plantilla = PLANTILLAS_POR_TIPO[tipoEntidad]
  if (!plantilla) throw new Error(`No hay plantilla de cargos para el tipo de entidad "${tipoEntidad}".`)

  const empleos = await db.empleoDafp.findMany()
  const empleoPorCodigo = new Map(empleos.map((e) => [e.codigo, e]))

  const idPorCodigo = new Map<string, string>()
  const ordenadas = ordenarPorJerarquia(plantilla.dependencias)
  let cargos = 0

  for (const d of ordenadas) {
    const padreId = d.padreCodigo ? idPorCodigo.get(d.padreCodigo) ?? null : null
    const dep = await db.dependencia.upsert({
      where: { codigo: d.codigo },
      update: { nombre: d.nombre, tipo: d.tipo, esServicioCompartido: !!d.esServicioCompartido, padreId },
      create: { codigo: d.codigo, nombre: d.nombre, tipo: d.tipo, esServicioCompartido: !!d.esServicioCompartido, padreId },
    })
    idPorCodigo.set(d.codigo, dep.id)

    for (const c of d.cargos) {
      const existente = await db.cargo.findFirst({ where: { dependenciaId: dep.id, nombre: c.nombre } })
      const grants = (c.grants ?? {}) as object
      const empleo = c.empleoCodigo ? empleoPorCodigo.get(c.empleoCodigo) ?? null : null
      const empleoId = empleo?.id ?? null
      const nivel = empleo?.nivel ?? null
      const funciones = c.funciones ?? null
      if (existente) {
        await db.cargo.update({ where: { id: existente.id }, data: { esJefatura: !!c.esJefatura, grants, empleoId, nivel, funciones } })
      } else {
        await db.cargo.create({ data: { dependenciaId: dep.id, nombre: c.nombre, esJefatura: !!c.esJefatura, grants, empleoId, nivel, funciones } })
        cargos++
      }
    }
  }

  return { dependencias: ordenadas.length, cargos }
}

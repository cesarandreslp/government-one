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
        { nombre: "Jefe de Oficina Jurídica", esJefatura: true, empleoCodigo: "115-01", grants: { contratacion: ["concepto_juridico", "revisar_juridica"] },
          funciones: "Dirigir la oficina jurídica; conceptuar y revisar jurídicamente los procesos contractuales y actos administrativos de la entidad." },
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
      codigo: "TH", nombre: "Oficina de Talento Humano", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Jefe de Talento Humano", esJefatura: true, empleoCodigo: "068-01", grants: { gestion_humana: ["gestionar_funcionarios", "actos_administrativos", "consultar"] },
          funciones: "Dirigir la gestión del talento humano: vinculación, actos administrativos, nómina y bienestar." },
        { nombre: "Profesional de Talento Humano", empleoCodigo: "219-02", grants: { gestion_humana: ["gestionar_funcionarios", "actos_administrativos", "consultar"] },
          funciones: "Gestionar la vinculación de funcionarios y los actos administrativos de personal." },
      ],
    },
    {
      codigo: "HAC", nombre: "Secretaría de Hacienda", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Hacienda", esJefatura: true, empleoCodigo: "020-01", grants: { presupuesto: ["aprobar"], ventanilla_unica: ["responder"] } },
        { nombre: "Profesional de Presupuesto", empleoCodigo: "222-02", grants: { presupuesto: ["expedir_cdp", "expedir_rp"] },
          funciones: "Expedir y hacer seguimiento a CDP y RP; controlar la ejecución presupuestal." },
      ],
    },
    {
      codigo: "PLAN", nombre: "Secretaría de Planeación", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Planeación", esJefatura: true, empleoCodigo: "020-01", grants: { ventanilla_unica: ["responder"] } },
        { nombre: "Profesional Especializado — Banco de Proyectos y Plan de Desarrollo", empleoCodigo: "222-02",
          grants: { banco_proyectos: ["administrar", "reportar_avance", "consultar"] },
          funciones: "Liderar el banco de proyectos y el seguimiento financiero y físico al cumplimiento del Plan de Desarrollo de todas las dependencias." },
        { nombre: "Profesional Universitario — Seguimiento PDM y Contratación", empleoCodigo: "219-02",
          grants: { contratacion: ["elaborar"] },
          funciones: "Seguimiento al cumplimiento del componente de Planeación en el Plan de Desarrollo; apoyo a la contratación de la dependencia y al alumbrado público." },
        { nombre: "Técnico Administrativo — Estratificación", empleoCodigo: "367-02",
          funciones: "Actualizar y hacer seguimiento a la estratificación socioeconómica del municipio." },
        { nombre: "Técnico Operativo — Ordenamiento Físico y Territorial", empleoCodigo: "314-02",
          grants: { ventanilla_unica: ["responder"] },
          funciones: "Atender trámites y consultas de ordenamiento territorial: línea de paramento, uso de suelo, licencias urbanísticas y demás asuntos del POT vigente." },
      ],
    },
    {
      codigo: "GOB", nombre: "Secretaría de Gobierno", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Gobierno", esJefatura: true, empleoCodigo: "020-01", grants: { contratacion: ["elaborar"], ventanilla_unica: ["responder"] } },
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
        { nombre: "Profesional de Talento Humano", empleoCodigo: "219-02", grants: { gestion_humana: ["gestionar_funcionarios", "actos_administrativos", "consultar"] },
          funciones: "Gestionar la vinculación de funcionarios y los actos administrativos de personal." },
      ],
    },
    {
      codigo: "DELEG", nombre: "Personería Delegada", tipo: "OFICINA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Personero Delegado", esJefatura: true, empleoCodigo: "222-02", grants: { ventanilla_unica: ["responder"] },
          funciones: "Ejercer las funciones delegadas por el Personero Municipal en materia de derechos humanos y ministerio público." },
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

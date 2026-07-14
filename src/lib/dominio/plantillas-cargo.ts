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
        { nombre: "Jefe de Oficina Jurídica", esJefatura: true, grants: { contratacion: ["concepto_juridico", "revisar_juridica"] } },
        { nombre: "Profesional Jurídico", grants: { contratacion: ["revisar_juridica"] } },
      ],
    },
    {
      codigo: "CONT", nombre: "Oficina de Contratación", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Jefe de Contratación", esJefatura: true, grants: { contratacion: ["elaborar", "aprobar"] } },
        { nombre: "Profesional de Contratación", grants: { contratacion: ["elaborar"] } },
      ],
    },
    {
      codigo: "ATC", nombre: "Atención al Ciudadano — Ventanilla Única", tipo: "OFICINA", esServicioCompartido: true, padreCodigo: "DESP",
      cargos: [
        { nombre: "Responsable de Ventanilla Única", esJefatura: true, grants: { ventanilla_unica: ["radicar", "asignar", "supervisar"], gestion_documental: ["radicar", "archivar", "administrar_trd"] } },
        { nombre: "Auxiliar de Ventanilla", grants: { ventanilla_unica: ["radicar"], gestion_documental: ["radicar"] } },
      ],
    },
    {
      codigo: "HAC", nombre: "Secretaría de Hacienda", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Hacienda", esJefatura: true, grants: { presupuesto: ["aprobar"], ventanilla_unica: ["responder"] } },
        { nombre: "Profesional de Presupuesto", grants: { presupuesto: ["expedir_cdp", "expedir_rp"] } },
      ],
    },
    {
      codigo: "PLAN", nombre: "Secretaría de Planeación", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Planeación", esJefatura: true, grants: { contratacion: ["elaborar"], ventanilla_unica: ["responder"] } },
      ],
    },
    {
      codigo: "GOB", nombre: "Secretaría de Gobierno", tipo: "SECRETARIA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Secretario de Gobierno", esJefatura: true, grants: { contratacion: ["elaborar"], ventanilla_unica: ["responder"] } },
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
        { nombre: "Responsable de Ventanilla Única", esJefatura: true, grants: { ventanilla_unica: ["radicar", "asignar"], gestion_documental: ["radicar", "archivar", "administrar_trd"] } },
      ],
    },
    {
      codigo: "DELEG", nombre: "Personería Delegada", tipo: "OFICINA", padreCodigo: "DESP",
      cargos: [
        { nombre: "Personero Delegado", esJefatura: true, grants: { ventanilla_unica: ["responder"] } },
        { nombre: "Profesional Universitario", grants: { ventanilla_unica: ["responder"], gestion_documental: ["consultar"] } },
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

export type SembradorDB = Pick<PrismaClient, "dependencia" | "cargo">

/**
 * Siembra en la BD del tenant el árbol de dependencias + cargos de la plantilla del tipo de
 * entidad. Idempotente: las dependencias por `codigo` y los cargos por (dependencia, nombre)
 * se upsertean, así re-aplicarla no duplica. Devuelve cuántas dependencias/cargos quedaron.
 */
export async function aplicarPlantilla(
  db: SembradorDB,
  tipoEntidad: string,
): Promise<{ dependencias: number; cargos: number }> {
  const plantilla = PLANTILLAS_POR_TIPO[tipoEntidad]
  if (!plantilla) throw new Error(`No hay plantilla de cargos para el tipo de entidad "${tipoEntidad}".`)

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
      if (existente) {
        await db.cargo.update({ where: { id: existente.id }, data: { esJefatura: !!c.esJefatura, grants } })
      } else {
        await db.cargo.create({ data: { dependenciaId: dep.id, nombre: c.nombre, esJefatura: !!c.esJefatura, grants } })
        cargos++
      }
    }
  }

  return { dependencias: ordenadas.length, cargos }
}

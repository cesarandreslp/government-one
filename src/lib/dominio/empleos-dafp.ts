import type { PrismaClient } from "@/generated/tenant/client"

// Catálogo NACIONAL de empleos (Decreto 785/2005 — nomenclatura, clasificación y remuneración de
// empleos para entidades territoriales). Corte operativo CURADO (mismo criterio que el CGC de
// Contabilidad: los códigos/denominaciones más usados en alcaldías/personerías municipales, no el
// manual DAFP completo) — editable una vez sembrado; si la entidad usa un código propio, lo ajusta
// o agrega el suyo. `Cargo.nivel` se DERIVA de este catálogo al asignar el empleo, no se elige a mano.

export type NivelEmpleo = "ASISTENCIAL" | "TECNICO" | "PROFESIONAL" | "ASESOR" | "DIRECTIVO"

export interface EmpleoDafpSeed {
  codigo: string
  denominacion: string
  nivel: NivelEmpleo
}

export const EMPLEOS_DAFP: EmpleoDafpSeed[] = [
  // Directivo
  { codigo: "020-01", denominacion: "Secretario de Despacho", nivel: "DIRECTIVO" },
  { codigo: "068-01", denominacion: "Director Administrativo", nivel: "DIRECTIVO" },
  { codigo: "090-01", denominacion: "Director Operativo", nivel: "DIRECTIVO" },

  // Asesor
  { codigo: "105-01", denominacion: "Asesor", nivel: "ASESOR" },
  { codigo: "115-01", denominacion: "Jefe de Oficina Asesora", nivel: "ASESOR" },

  // Profesional
  { codigo: "219-01", denominacion: "Profesional Universitario Grado 1", nivel: "PROFESIONAL" },
  { codigo: "219-02", denominacion: "Profesional Universitario Grado 2", nivel: "PROFESIONAL" },
  { codigo: "222-01", denominacion: "Profesional Especializado Grado 1", nivel: "PROFESIONAL" },
  { codigo: "222-02", denominacion: "Profesional Especializado Grado 2", nivel: "PROFESIONAL" },
  { codigo: "222-03", denominacion: "Profesional Especializado Grado 3", nivel: "PROFESIONAL" },
  { codigo: "222-04", denominacion: "Profesional Especializado Grado 4", nivel: "PROFESIONAL" },

  // Técnico
  { codigo: "367-01", denominacion: "Técnico Administrativo Grado 1", nivel: "TECNICO" },
  { codigo: "367-02", denominacion: "Técnico Administrativo Grado 2", nivel: "TECNICO" },
  { codigo: "367-03", denominacion: "Técnico Administrativo Grado 3", nivel: "TECNICO" },
  { codigo: "314-01", denominacion: "Técnico Operativo Grado 1", nivel: "TECNICO" },
  { codigo: "314-02", denominacion: "Técnico Operativo Grado 2", nivel: "TECNICO" },

  // Asistencial
  { codigo: "407-01", denominacion: "Auxiliar Administrativo Grado 1", nivel: "ASISTENCIAL" },
  { codigo: "407-02", denominacion: "Auxiliar Administrativo Grado 2", nivel: "ASISTENCIAL" },
  { codigo: "407-03", denominacion: "Auxiliar Administrativo Grado 3", nivel: "ASISTENCIAL" },
  { codigo: "425-01", denominacion: "Secretario Ejecutivo", nivel: "ASISTENCIAL" },
  { codigo: "440-01", denominacion: "Conductor Mecánico", nivel: "ASISTENCIAL" },
  { codigo: "470-01", denominacion: "Auxiliar de Servicios Generales", nivel: "ASISTENCIAL" },
]

export type SembradorEmpleosDB = Pick<PrismaClient, "empleoDafp">

/** Siembra el catálogo de empleos DAFP en la BD del tenant (idempotente, upsert por código). */
export async function sembrarEmpleosDafp(db: SembradorEmpleosDB): Promise<{ empleos: number }> {
  let nuevos = 0
  for (const e of EMPLEOS_DAFP) {
    const existente = await db.empleoDafp.findUnique({ where: { codigo: e.codigo } })
    if (existente) {
      await db.empleoDafp.update({ where: { id: existente.id }, data: { denominacion: e.denominacion, nivel: e.nivel as never } })
    } else {
      await db.empleoDafp.create({ data: { codigo: e.codigo, denominacion: e.denominacion, nivel: e.nivel as never } })
      nuevos++
    }
  }
  return { empleos: nuevos }
}

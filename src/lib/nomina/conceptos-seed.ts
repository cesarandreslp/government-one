import type { PrismaClient } from "@/generated/tenant/client"

// Catálogo de conceptos de nómina — corte CURADO (mismo criterio que el CGC/CCPET/DAFP): las
// tarifas legales de seguridad social vigentes en Colombia (salud 4%/8.5%, pensión 4%/12%, ARL
// clase I 0.522%, caja 4%, ICBF 3%, SENA 2%, cesantías 8.33%) más los devengados más comunes —
// editable por tenant una vez sembrado. Deliberadamente NO incluye retención en la fuente (exige
// tablas UVT/DIAN progresivas que no vamos a fingir calcular con un placeholder) ni horas extra
// (varía cada periodo, no encaja en un concepto de fórmula fija — queda para cuando exista
// captura de novedades). Prima de servicios se mensualiza como aproximación (8.33%) en vez del
// cálculo legal semestral real — mismo tipo de simplificación documentada que ya usa el proyecto
// en otros cortes iniciales.

export interface ConceptoNominaSeed {
  codigo: string
  nombre: string
  tipo: "DEVENGADO" | "DEDUCCION" | "APORTE_PATRONAL" | "PRESTACION_SOCIAL"
  formula: "FIJO" | "PORCENTAJE_SUELDO" | "PORCENTAJE_IBC" | "PORCENTAJE_DEVENGADO"
  porcentaje?: number
  valorFijo?: number
  constitutivoSalario?: boolean
  cuentaContableCodigo: string
  orden: number
}

export const CONCEPTOS_NOMINA: ConceptoNominaSeed[] = [
  // Devengados
  { codigo: "NC-001", nombre: "Sueldo Básico", tipo: "DEVENGADO", formula: "PORCENTAJE_SUELDO", porcentaje: 1, constitutivoSalario: true, cuentaContableCodigo: "510101", orden: 10 },
  { codigo: "NC-002", nombre: "Prima de Servicios (mensualizada)", tipo: "DEVENGADO", formula: "PORCENTAJE_SUELDO", porcentaje: 0.0833, cuentaContableCodigo: "510102", orden: 20 },
  { codigo: "NC-003", nombre: "Auxilio de Transporte", tipo: "DEVENGADO", formula: "FIJO", valorFijo: 200000, cuentaContableCodigo: "510104", orden: 30 },

  // Deducciones del empleado
  { codigo: "NC-101", nombre: "Aporte a Salud (empleado)", tipo: "DEDUCCION", formula: "PORCENTAJE_IBC", porcentaje: 0.04, cuentaContableCodigo: "250503", orden: 110 },
  { codigo: "NC-102", nombre: "Aporte a Pensión (empleado)", tipo: "DEDUCCION", formula: "PORCENTAJE_IBC", porcentaje: 0.04, cuentaContableCodigo: "250504", orden: 120 },

  // Aportes patronales (gasto de la entidad, no afectan el neto del funcionario)
  { codigo: "NC-201", nombre: "Aporte a Salud (patronal)", tipo: "APORTE_PATRONAL", formula: "PORCENTAJE_IBC", porcentaje: 0.085, cuentaContableCodigo: "510301", orden: 210 },
  { codigo: "NC-202", nombre: "Aporte a Pensión (patronal)", tipo: "APORTE_PATRONAL", formula: "PORCENTAJE_IBC", porcentaje: 0.12, cuentaContableCodigo: "510302", orden: 220 },
  { codigo: "NC-203", nombre: "Aporte a Riesgos Laborales (ARL, clase I)", tipo: "APORTE_PATRONAL", formula: "PORCENTAJE_IBC", porcentaje: 0.00522, cuentaContableCodigo: "510306", orden: 230 },
  { codigo: "NC-204", nombre: "Aporte a Caja de Compensación Familiar", tipo: "APORTE_PATRONAL", formula: "PORCENTAJE_IBC", porcentaje: 0.04, cuentaContableCodigo: "510303", orden: 240 },
  { codigo: "NC-205", nombre: "Aporte al ICBF", tipo: "APORTE_PATRONAL", formula: "PORCENTAJE_IBC", porcentaje: 0.03, cuentaContableCodigo: "510304", orden: 250 },
  { codigo: "NC-206", nombre: "Aporte al SENA", tipo: "APORTE_PATRONAL", formula: "PORCENTAJE_IBC", porcentaje: 0.02, cuentaContableCodigo: "510305", orden: 260 },

  // Prestaciones sociales (provisión, tampoco afectan el neto)
  { codigo: "NC-301", nombre: "Cesantías", tipo: "PRESTACION_SOCIAL", formula: "PORCENTAJE_IBC", porcentaje: 0.0833, cuentaContableCodigo: "510701", orden: 310 },
]

export type SembradorConceptosDB = Pick<PrismaClient, "conceptoNomina">

/** Siembra el catálogo de conceptos de nómina en la BD del tenant (idempotente, upsert por código). */
export async function sembrarConceptosNomina(db: SembradorConceptosDB): Promise<{ conceptos: number }> {
  let nuevos = 0
  for (const c of CONCEPTOS_NOMINA) {
    const data = {
      nombre: c.nombre,
      tipo: c.tipo as never,
      formula: c.formula as never,
      porcentaje: c.porcentaje ?? null,
      valorFijo: c.valorFijo ?? null,
      constitutivoSalario: !!c.constitutivoSalario,
      cuentaContableCodigo: c.cuentaContableCodigo,
      orden: c.orden,
    }
    const existente = await db.conceptoNomina.findUnique({ where: { codigo: c.codigo } })
    if (existente) {
      await db.conceptoNomina.update({ where: { id: existente.id }, data })
    } else {
      await db.conceptoNomina.create({ data: { codigo: c.codigo, ...data } })
      nuevos++
    }
  }
  return { conceptos: nuevos }
}

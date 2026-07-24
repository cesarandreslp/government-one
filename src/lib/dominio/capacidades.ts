// Catálogo NACIONAL de capacidades por módulo (primitivo de PLATAFORMA, no de entidad).
// Una capacidad = un verbo de autoridad dentro de un módulo. Los grants (de un cargo, o de
// un override individual) usan SIEMPRE el formato { moduloId: capacidad[] }.
//
// Data-driven: el código no conoce ninguna entidad; solo este vocabulario. Cada módulo
// AMPLÍA el catálogo cuando se construye; aquí viven las capacidades ya decididas en la
// fundación (contratación/presupuesto, y el módulo base Portal+GD+Ventanilla Única).

export const CAPACIDADES_POR_MODULO = {
  gestion_documental: ["radicar", "archivar", "consultar", "administrar_trd"],
  ventanilla_unica: ["radicar", "asignar", "responder", "supervisar"],
  contabilidad: ["consultar", "registrar", "administrar", "cerrar_periodo"],
  contratacion: ["elaborar", "revisar_juridica", "concepto_juridico", "supervisar", "aprobar"],
  presupuesto: ["consultar", "administrar", "expedir_cdp", "expedir_rp", "aprobar"],
  banco_proyectos: ["consultar", "administrar", "reportar_avance"],
  gestion_humana: ["gestionar_funcionarios", "actos_administrativos", "consultar"],
  nomina: ["consultar", "liquidar", "pagar"],
  tesoreria: ["consultar", "administrar", "conciliar"],
} as const

export type ModuloId = keyof typeof CAPACIDADES_POR_MODULO

/** Grants: capacidades por módulo. Mismo formato en cargo y en override individual. */
export type Grants = Record<string, string[]>

/** ¿La capacidad existe en el catálogo del módulo? (para validar al editar cargos). */
export function esCapacidadValida(modulo: string, capacidad: string): boolean {
  const caps = (CAPACIDADES_POR_MODULO as Record<string, readonly string[]>)[modulo]
  return !!caps && caps.includes(capacidad)
}

/** Une varios grants en uno solo: unión de capacidades por módulo, sin duplicados. */
export function unirGrants(...fuentes: Grants[]): Grants {
  const out: Grants = {}
  for (const g of fuentes) {
    for (const [modulo, caps] of Object.entries(g ?? {})) {
      const set = new Set(out[modulo] ?? [])
      for (const c of caps ?? []) set.add(c)
      out[modulo] = [...set]
    }
  }
  return out
}

/** ¿El bundle de grants incluye esta capacidad en este módulo? */
export function grantsIncluyen(grants: Grants, modulo: string, capacidad: string): boolean {
  return (grants[modulo] ?? []).includes(capacidad)
}

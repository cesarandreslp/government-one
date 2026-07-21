import type { PrismaClient } from "@/generated/tenant/client"

// CCPET — Catálogo de Clasificación Presupuestal para Entidades Territoriales (Ministerio de
// Hacienda, Dirección General de Apoyo Fiscal Territorial. Res. 3832/2019 + 2662/2023). Es un
// CATÁLOGO NACIONAL (primitivo de plataforma, como el CGC/Res.1519) → se siembra por tenant,
// editable. Clasifica el presupuesto (ingresos y gastos), distinto del CGC (plan de cuentas
// contable de doble partida) — son catálogos paralelos, no se pisan.
//
// Catálogo REAL Y COMPLETO (1.784 rubros territoriales, sin curar) — a diferencia del CGC (donde
// no teníamos el PDF oficial y se curó un subset), aquí sí hay xlsx oficial fuente. Ver
// ccpet-rubros.generated.ts.

export interface RubroCcpet {
  codigo: string
  nombre: string
  tipo: "INGRESO" | "GASTO"
  nivel: number
  permiteMovimientos: boolean
  parent?: string
}

import { CCPET_RUBROS_OFICIAL } from "./ccpet-rubros.generated"

export const CCPET_RUBROS: RubroCcpet[] = CCPET_RUBROS_OFICIAL

/**
 * Siembra el CCPET en la BD del tenant. Idempotente (upsert por `codigo`). Resuelve `parentId`
 * por pasadas hasta cerrar el grafo jerárquico. Devuelve cuántos rubros quedaron.
 */
export async function aplicarClasificacionPresupuestal(
  db: Pick<PrismaClient, "rubroPresupuestal">,
): Promise<{ total: number }> {
  const idPorCodigo = new Map<string, string>()
  let pendientes = [...CCPET_RUBROS]

  while (pendientes.length) {
    const listas = pendientes.filter((r) => !r.parent || idPorCodigo.has(r.parent))
    if (listas.length === 0) {
      throw new Error(`CCPET: rubros con parent inexistente: ${pendientes.slice(0, 8).map((p) => p.codigo).join(", ")}…`)
    }
    for (const r of listas) {
      const parentId = r.parent ? idPorCodigo.get(r.parent) ?? null : null
      const data = { nombre: r.nombre, tipo: r.tipo as never, nivel: r.nivel, permiteMovimientos: r.permiteMovimientos, parentId }
      const saved = await db.rubroPresupuestal.upsert({ where: { codigo: r.codigo }, create: { codigo: r.codigo, ...data }, update: data })
      idPorCodigo.set(r.codigo, saved.id)
    }
    pendientes = pendientes.filter((r) => !idPorCodigo.has(r.codigo))
  }
  return { total: idPorCodigo.size }
}

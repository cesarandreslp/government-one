import type { PrismaClient } from "@/generated/tenant/client"

// El "empleado de nómina" es un Usuario con VinculacionCargo vigente que tiene salario asignado
// (RRHH lo fija al posesionar, ver /admin/rrhh). Si tiene varias vinculaciones vigentes con
// salario (ej. titular de un cargo + encargo de otro), se liquida por la de mayor salario —
// simplificación deliberada del principio real (el encargo paga la diferencia si es mayor),
// documentada aquí en vez de fingir la regla completa.

export type SalarioDB = Pick<PrismaClient, "vinculacionCargo" | "usuario">

export interface SalarioVigente {
  vinculacionId: string
  salarioBasico: number
}

function vigente(v: { desde: Date; hasta: Date | null }, ahora: Date): boolean {
  return v.desde <= ahora && (v.hasta === null || v.hasta >= ahora)
}

/** Salario vigente de un funcionario (o null si no tiene ninguna vinculación con salario fijado). */
export async function salarioVigente(db: SalarioDB, usuarioId: string, ahora: Date = new Date()): Promise<SalarioVigente | null> {
  const vinculaciones = await db.vinculacionCargo.findMany({ where: { usuarioId, salarioBasico: { not: null } } })
  const vigentes = vinculaciones.filter((v) => vigente(v, ahora))
  if (vigentes.length === 0) return null
  const mejor = vigentes.reduce((a, b) => (Number(b.salarioBasico) > Number(a.salarioBasico) ? b : a))
  return { vinculacionId: mejor.id, salarioBasico: Number(mejor.salarioBasico) }
}

export interface EmpleadoLiquidable {
  usuarioId: string
  nombre: string
  apellido: string
  vinculacionId: string
  salarioBasico: number
}

/** Todos los funcionarios activos con salario vigente — universo liquidable de un periodo. */
export async function empleadosLiquidables(db: SalarioDB, ahora: Date = new Date()): Promise<EmpleadoLiquidable[]> {
  const usuarios = await db.usuario.findMany({ where: { activo: true }, select: { id: true, nombre: true, apellido: true } })
  const out: EmpleadoLiquidable[] = []
  for (const u of usuarios) {
    const s = await salarioVigente(db, u.id, ahora)
    if (s) out.push({ usuarioId: u.id, nombre: u.nombre, apellido: u.apellido, vinculacionId: s.vinculacionId, salarioBasico: s.salarioBasico })
  }
  return out
}

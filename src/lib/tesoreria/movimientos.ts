import type { PrismaClient } from "@/generated/tenant/client"

// El "movimiento de tesorería" NO es una tabla propia — es una vista derivada de los Asientos
// reales que Presupuesto (Pago), Nómina (pago de periodo/pasivo) y Contabilidad (comprobante
// manual, incluido el que registra esta misma Tesorería) ya postearon sobre la cuenta bancaria.
// Cero duplicación: el saldo de tesorería es SIEMPRE el mismo número que el libro mayor.

export type TesoreriaDB = Pick<PrismaClient, "asiento" | "tesoConciliacion">

export interface MovimientoDerivado {
  asientoId: string
  fecha: Date
  numero: string
  descripcion: string
  fuenteModulo: string | null
  debito: number
  credito: number
  conciliado: boolean
}

/** Saldo de una cuenta contable (naturaleza débito: entra por débito, sale por crédito). */
export async function saldoCuentaContable(db: Pick<PrismaClient, "asiento">, cuentaContableId: string): Promise<number> {
  const asientos = await db.asiento.findMany({ where: { cuentaId: cuentaContableId }, select: { debito: true, credito: true } })
  return asientos.reduce((s, a) => s + Number(a.debito) - Number(a.credito), 0)
}

/** Todos los movimientos (Asientos) de una cuenta contable, con su estado de conciliación. */
export async function movimientosDeCuenta(db: TesoreriaDB, cuentaContableId: string): Promise<MovimientoDerivado[]> {
  const asientos = await db.asiento.findMany({
    where: { cuentaId: cuentaContableId },
    include: { comprobante: true, tesoConciliacion: true },
    orderBy: { comprobante: { fecha: "desc" } },
  })
  return asientos.map((a) => ({
    asientoId: a.id,
    fecha: a.comprobante.fecha,
    numero: a.comprobante.numero,
    descripcion: a.descripcion ?? a.comprobante.descripcion,
    fuenteModulo: a.comprobante.fuenteModulo,
    debito: Number(a.debito),
    credito: Number(a.credito),
    conciliado: !!a.tesoConciliacion,
  }))
}

/** Movimientos SIN conciliar de una cuenta — universo elegible para el panel de conciliación. */
export async function movimientosPendientes(db: TesoreriaDB, cuentaContableId: string): Promise<MovimientoDerivado[]> {
  const todos = await movimientosDeCuenta(db, cuentaContableId)
  return todos.filter((m) => !m.conciliado)
}

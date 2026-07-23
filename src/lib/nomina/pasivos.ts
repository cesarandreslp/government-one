import type { PrismaClient } from "@/generated/tenant/client"

// Pasivos que deja el pago de nómina (salud/pensión/aportes patronales/retención/cesantías) —
// segunda mitad del ciclo: primero se causa el pasivo al pagar la planilla (pagarPeriodoAction),
// después se gira a cada tercero (EPS, AFP, ARL, caja, DIAN). El saldo pendiente por cuenta es
// (créditos causados por nómina) − (pagos de pasivo ya registrados) — mismo patrón que
// "disponible" en Presupuesto (CDP − RP, RP − Obligación, …).

export const CUENTAS_PASIVO_NOMINA = ["250502", "250503", "250504", "250505", "243601"]

export type PasivosDB = Pick<PrismaClient, "planCuenta" | "asiento" | "nominaPagoPasivo">

export interface SaldoPasivo {
  cuentaId: string
  codigo: string
  nombre: string
  causado: number
  pagado: number
  pendiente: number
}

export async function saldosPasivosNomina(db: PasivosDB): Promise<SaldoPasivo[]> {
  const cuentas = await db.planCuenta.findMany({ where: { codigo: { in: CUENTAS_PASIVO_NOMINA } } })
  const resultados: SaldoPasivo[] = []
  for (const cuenta of cuentas) {
    const asientos = await db.asiento.findMany({
      where: { cuentaId: cuenta.id, comprobante: { fuenteModulo: "nomina" } },
      select: { credito: true, debito: true },
    })
    const causado = asientos.reduce((s, a) => s + Number(a.credito) - Number(a.debito), 0)
    const pagos = await db.nominaPagoPasivo.aggregate({ where: { cuentaCodigo: cuenta.codigo }, _sum: { valor: true } })
    const pagado = Number(pagos._sum.valor ?? 0)
    const pendiente = Math.round((causado - pagado) * 100) / 100
    if (pendiente > 0.5) resultados.push({ cuentaId: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre, causado, pagado, pendiente })
  }
  return resultados
}

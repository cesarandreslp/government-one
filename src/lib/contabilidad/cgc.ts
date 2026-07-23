import type { PrismaClient } from "@/generated/tenant/client"

// CGC — Catálogo General de Cuentas de la Contaduría General de la Nación, Marco Normativo para
// Entidades de Gobierno (Resolución CGN 533/2015). Es un CATÁLOGO NACIONAL (primitivo de
// plataforma, como CCPET/Res.1519), NO dato de entidad → se siembra por tenant y es editable.
//
// Este es un CORTE OPERATIVO curado (clases 1..5 + hojas usuales) suficiente para registrar
// comprobantes reales y sacar un balance. El catálogo COMPLETO (~2.700 cuentas del PDF oficial
// CGN) se cargará después como carga masiva, manteniendo la misma forma y `aplicarPlanCuentas`.
//
// Código CGN: X-XX-XX-XX. nivel 1=Clase(1díg) · 2=Grupo(2díg) · 3=Cuenta(4díg) · 4=Subcuenta(6díg).
// Solo las hojas (subcuentas) reciben asientos → permiteMovimientos=true.

export interface CuentaCgc {
  codigo: string
  nombre: string
  nivel: number
  naturaleza: "DEBITO" | "CREDITO"
  tipo: "BALANCE" | "RESULTADO" | "ORDEN"
  permiteMovimientos: boolean
  parent?: string
}

const D = "DEBITO" as const
const C = "CREDITO" as const
const B = "BALANCE" as const
const R = "RESULTADO" as const

export const CGC_CUENTAS: CuentaCgc[] = [
  // ── CLASE 1 · ACTIVOS ────────────────────────────────────────────────────────────
  { codigo: "1", nombre: "ACTIVOS", nivel: 1, naturaleza: D, tipo: B, permiteMovimientos: false },
  { codigo: "11", nombre: "Efectivo y equivalentes al efectivo", nivel: 2, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "1" },
  { codigo: "1105", nombre: "Caja", nivel: 3, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "11" },
  { codigo: "110501", nombre: "Caja principal", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1105" },
  { codigo: "1110", nombre: "Depósitos en instituciones financieras", nivel: 3, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "11" },
  { codigo: "111005", nombre: "Cuenta corriente", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1110" },
  { codigo: "111006", nombre: "Cuenta de ahorro", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1110" },
  { codigo: "13", nombre: "Cuentas por cobrar", nivel: 2, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "1" },
  { codigo: "1305", nombre: "Impuestos, retención en la fuente y anticipos", nivel: 3, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "13" },
  { codigo: "130507", nombre: "Impuesto predial unificado", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1305" },
  { codigo: "1384", nombre: "Otras cuentas por cobrar", nivel: 3, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "13" },
  { codigo: "138490", nombre: "Otras cuentas por cobrar", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1384" },
  { codigo: "16", nombre: "Propiedades, planta y equipo", nivel: 2, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "1" },
  { codigo: "1605", nombre: "Terrenos", nivel: 3, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "16" },
  { codigo: "160501", nombre: "Terrenos urbanos", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1605" },
  { codigo: "1640", nombre: "Edificaciones", nivel: 3, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "16" },
  { codigo: "164001", nombre: "Edificios y casas", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1640" },
  { codigo: "1665", nombre: "Muebles, enseres y equipo de oficina", nivel: 3, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "16" },
  { codigo: "166501", nombre: "Muebles y enseres", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1665" },
  { codigo: "1670", nombre: "Equipos de comunicación y computación", nivel: 3, naturaleza: D, tipo: B, permiteMovimientos: false, parent: "16" },
  { codigo: "167002", nombre: "Equipo de computación", nivel: 4, naturaleza: D, tipo: B, permiteMovimientos: true, parent: "1670" },
  { codigo: "1685", nombre: "Depreciación acumulada de PP&E (CR)", nivel: 3, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "16" },
  { codigo: "168504", nombre: "Edificaciones", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "1685" },
  { codigo: "168506", nombre: "Muebles, enseres y equipo de oficina", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "1685" },

  // ── CLASE 2 · PASIVOS ────────────────────────────────────────────────────────────
  { codigo: "2", nombre: "PASIVOS", nivel: 1, naturaleza: C, tipo: B, permiteMovimientos: false },
  { codigo: "24", nombre: "Cuentas por pagar", nivel: 2, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "2" },
  { codigo: "2401", nombre: "Adquisición de bienes y servicios nacionales", nivel: 3, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "24" },
  { codigo: "240101", nombre: "Bienes y servicios", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2401" },
  { codigo: "2436", nombre: "Retención en la fuente e impuesto de timbre", nivel: 3, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "24" },
  { codigo: "243601", nombre: "Salarios", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2436" },
  { codigo: "243603", nombre: "Honorarios", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2436" },
  { codigo: "243608", nombre: "Compras", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2436" },
  { codigo: "25", nombre: "Beneficios a los empleados", nivel: 2, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "2" },
  { codigo: "2505", nombre: "Beneficios a los empleados a corto plazo", nivel: 3, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "25" },
  { codigo: "250501", nombre: "Nómina por pagar", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2505" },
  { codigo: "250502", nombre: "Cesantías", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2505" },
  { codigo: "250503", nombre: "Aportes a salud por pagar", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2505" },
  { codigo: "250504", nombre: "Aportes a pensión por pagar", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2505" },
  { codigo: "250505", nombre: "Aportes patronales por pagar", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "2505" },

  // ── CLASE 3 · PATRIMONIO ─────────────────────────────────────────────────────────
  { codigo: "3", nombre: "PATRIMONIO", nivel: 1, naturaleza: C, tipo: B, permiteMovimientos: false },
  { codigo: "31", nombre: "Patrimonio de las entidades de gobierno", nivel: 2, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "3" },
  { codigo: "3105", nombre: "Capital fiscal", nivel: 3, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "31" },
  { codigo: "310506", nombre: "Capital fiscal", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "3105" },
  { codigo: "3109", nombre: "Resultados de ejercicios anteriores", nivel: 3, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "31" },
  { codigo: "310901", nombre: "Resultados de ejercicios anteriores", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "3109" },
  { codigo: "3110", nombre: "Resultado del ejercicio", nivel: 3, naturaleza: C, tipo: B, permiteMovimientos: false, parent: "31" },
  { codigo: "311001", nombre: "Resultado del ejercicio", nivel: 4, naturaleza: C, tipo: B, permiteMovimientos: true, parent: "3110" },

  // ── CLASE 4 · INGRESOS ───────────────────────────────────────────────────────────
  { codigo: "4", nombre: "INGRESOS", nivel: 1, naturaleza: C, tipo: R, permiteMovimientos: false },
  { codigo: "41", nombre: "Ingresos fiscales", nivel: 2, naturaleza: C, tipo: R, permiteMovimientos: false, parent: "4" },
  { codigo: "4105", nombre: "Impuestos", nivel: 3, naturaleza: C, tipo: R, permiteMovimientos: false, parent: "41" },
  { codigo: "410502", nombre: "Impuesto predial unificado", nivel: 4, naturaleza: C, tipo: R, permiteMovimientos: true, parent: "4105" },
  { codigo: "410510", nombre: "Impuesto de industria y comercio", nivel: 4, naturaleza: C, tipo: R, permiteMovimientos: true, parent: "4105" },
  { codigo: "44", nombre: "Transferencias y subvenciones", nivel: 2, naturaleza: C, tipo: R, permiteMovimientos: false, parent: "4" },
  { codigo: "4428", nombre: "Sistema General de Participaciones", nivel: 3, naturaleza: C, tipo: R, permiteMovimientos: false, parent: "44" },
  { codigo: "442801", nombre: "SGP - Libre destinación", nivel: 4, naturaleza: C, tipo: R, permiteMovimientos: true, parent: "4428" },

  // ── CLASE 5 · GASTOS ─────────────────────────────────────────────────────────────
  { codigo: "5", nombre: "GASTOS", nivel: 1, naturaleza: D, tipo: R, permiteMovimientos: false },
  { codigo: "51", nombre: "De administración y operación", nivel: 2, naturaleza: D, tipo: R, permiteMovimientos: false, parent: "5" },
  { codigo: "5101", nombre: "Sueldos y salarios", nivel: 3, naturaleza: D, tipo: R, permiteMovimientos: false, parent: "51" },
  { codigo: "510101", nombre: "Sueldos", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5101" },
  { codigo: "510102", nombre: "Prima de servicios", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5101" },
  { codigo: "510103", nombre: "Horas extras y festivos", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5101" },
  { codigo: "510104", nombre: "Auxilio de transporte", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5101" },
  { codigo: "510105", nombre: "Auxilio por incapacidad", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5101" },
  { codigo: "5103", nombre: "Contribuciones efectivas", nivel: 3, naturaleza: D, tipo: R, permiteMovimientos: false, parent: "51" },
  { codigo: "510301", nombre: "Aportes a seguridad social en salud", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5103" },
  { codigo: "510302", nombre: "Aportes a seguridad social en pensiones", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5103" },
  { codigo: "510303", nombre: "Aportes a cajas de compensación familiar", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5103" },
  { codigo: "510304", nombre: "Aportes al ICBF", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5103" },
  { codigo: "510305", nombre: "Aportes al SENA", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5103" },
  { codigo: "510306", nombre: "Aportes a riesgos laborales (ARL)", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5103" },
  { codigo: "5107", nombre: "Prestaciones sociales", nivel: 3, naturaleza: D, tipo: R, permiteMovimientos: false, parent: "51" },
  { codigo: "510701", nombre: "Cesantías", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5107" },
  { codigo: "5111", nombre: "Generales", nivel: 3, naturaleza: D, tipo: R, permiteMovimientos: false, parent: "51" },
  { codigo: "511113", nombre: "Vigilancia y seguridad", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5111" },
  { codigo: "511117", nombre: "Servicios públicos", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5111" },
  { codigo: "511125", nombre: "Materiales y suministros", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5111" },
  { codigo: "53", nombre: "Deterioro, depreciaciones, amortizaciones y provisiones", nivel: 2, naturaleza: D, tipo: R, permiteMovimientos: false, parent: "5" },
  { codigo: "5360", nombre: "Depreciación de propiedades, planta y equipo", nivel: 3, naturaleza: D, tipo: R, permiteMovimientos: false, parent: "53" },
  { codigo: "536001", nombre: "Edificaciones", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5360" },
  { codigo: "536003", nombre: "Muebles, enseres y equipo de oficina", nivel: 4, naturaleza: D, tipo: R, permiteMovimientos: true, parent: "5360" },
]

/**
 * Siembra el CGC en la BD del tenant. Idempotente (upsert por `codigo`). Resuelve `parentId`
 * por pasadas hasta cerrar el grafo jerárquico. Devuelve cuántas cuentas quedaron.
 */
export async function aplicarPlanCuentas(db: Pick<PrismaClient, "planCuenta">): Promise<{ total: number }> {
  const idPorCodigo = new Map<string, string>()
  let pendientes = [...CGC_CUENTAS]

  while (pendientes.length) {
    const listas = pendientes.filter((c) => !c.parent || idPorCodigo.has(c.parent))
    if (listas.length === 0) {
      throw new Error(`CGC: cuentas con parent inexistente: ${pendientes.slice(0, 8).map((p) => p.codigo).join(", ")}…`)
    }
    for (const c of listas) {
      const parentId = c.parent ? idPorCodigo.get(c.parent) ?? null : null
      const data = { nombre: c.nombre, nivel: c.nivel, naturaleza: c.naturaleza as never, tipo: c.tipo as never, permiteMovimientos: c.permiteMovimientos, parentId }
      const saved = await db.planCuenta.upsert({ where: { codigo: c.codigo }, create: { codigo: c.codigo, ...data }, update: data })
      idPorCodigo.set(c.codigo, saved.id)
    }
    pendientes = pendientes.filter((c) => !idPorCodigo.has(c.codigo))
  }
  return { total: idPorCodigo.size }
}

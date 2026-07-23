// Motor de liquidación de nómina — función PURA (sin BD, sin framework), fácil de razonar y
// probar. Solo interpreta la `formula` de cada concepto; nunca reconoce un concepto por nombre
// (a diferencia de la referencia portada, que tenía un caso especial "si el nombre contiene
// 'prima'…" — aquí cada concepto declara su propia fórmula, sin heurísticas).
//
// Tres pasadas, en este orden (así lo pide el cálculo: las deducciones/aportes necesitan el IBC,
// que solo se conoce después de sumar los devengados):
//   1. DEVENGADO       → suma total devengado; el subtotal "constitutivo de salario" es el IBC.
//   2. DEDUCCION       → resta del neto del funcionario (salud/pensión del empleado, etc.).
//   3. APORTE_PATRONAL / PRESTACION_SOCIAL → gasto de la entidad, NO afectan el neto del funcionario.

export type ConceptoNominaTipo = "DEVENGADO" | "DEDUCCION" | "APORTE_PATRONAL" | "PRESTACION_SOCIAL"
export type FormulaConcepto = "FIJO" | "PORCENTAJE_SUELDO" | "PORCENTAJE_IBC" | "PORCENTAJE_DEVENGADO"

export interface ConceptoLiquidable {
  id: string
  tipo: ConceptoNominaTipo
  formula: FormulaConcepto
  porcentaje: number | null
  valorFijo: number | null
  constitutivoSalario: boolean
  orden: number
}

export interface LineaLiquidacion {
  conceptoId: string
  valor: number
  base: number | null
}

export interface ResultadoLiquidacion {
  ibc: number
  totalDevengado: number
  totalDeducciones: number
  totalAportesPatronales: number
  netoPagar: number
  lineas: LineaLiquidacion[]
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

function valorConcepto(c: ConceptoLiquidable, salarioBasico: number, base: number): number {
  switch (c.formula) {
    case "FIJO":
      return redondear(c.valorFijo ?? 0)
    case "PORCENTAJE_SUELDO":
      return redondear(salarioBasico * Number(c.porcentaje ?? 0))
    case "PORCENTAJE_IBC":
    case "PORCENTAJE_DEVENGADO":
      return redondear(base * Number(c.porcentaje ?? 0))
  }
}

export function liquidar(salarioBasico: number, conceptos: ConceptoLiquidable[]): ResultadoLiquidacion {
  const activos = [...conceptos].sort((a, b) => a.orden - b.orden)
  const lineas: LineaLiquidacion[] = []

  let totalDevengado = 0
  let ibc = 0
  for (const c of activos.filter((c) => c.tipo === "DEVENGADO")) {
    const valor = valorConcepto(c, salarioBasico, salarioBasico)
    lineas.push({ conceptoId: c.id, valor, base: null })
    totalDevengado += valor
    if (c.constitutivoSalario) ibc += valor
  }

  let totalDeducciones = 0
  for (const c of activos.filter((c) => c.tipo === "DEDUCCION")) {
    const base = c.formula === "PORCENTAJE_IBC" ? ibc : c.formula === "PORCENTAJE_DEVENGADO" ? totalDevengado : salarioBasico
    const valor = valorConcepto(c, salarioBasico, base)
    lineas.push({ conceptoId: c.id, valor, base })
    totalDeducciones += valor
  }

  let totalAportesPatronales = 0
  for (const c of activos.filter((c) => c.tipo === "APORTE_PATRONAL" || c.tipo === "PRESTACION_SOCIAL")) {
    const base = c.formula === "PORCENTAJE_IBC" ? ibc : salarioBasico
    const valor = valorConcepto(c, salarioBasico, base)
    lineas.push({ conceptoId: c.id, valor, base })
    totalAportesPatronales += valor
  }

  const netoPagar = redondear(totalDevengado - totalDeducciones)
  return { ibc, totalDevengado, totalDeducciones, totalAportesPatronales, netoPagar, lineas }
}

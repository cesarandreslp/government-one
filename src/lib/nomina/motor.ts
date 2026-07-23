// Motor de liquidación de nómina — función PURA (sin BD, sin framework), fácil de razonar y
// probar. Solo interpreta la `formula` de cada concepto; nunca reconoce un concepto por nombre.
//
// Tres pasadas, en este orden (así lo pide el cálculo: las deducciones/aportes necesitan el IBC,
// que solo se conoce después de sumar los devengados):
//   1. DEVENGADO       → suma total devengado; el subtotal "constitutivo de salario" es el IBC.
//   2. DEDUCCION       → resta del neto del funcionario (salud/pensión/retención del empleado).
//   3. APORTE_PATRONAL / PRESTACION_SOCIAL → gasto de la entidad, NO afectan el neto del funcionario.
//
// Novedades (vacaciones/licencia/incapacidad, ver Ausencia en RRHH) entran como `NovedadPeriodo`:
// prorratean los devengados por días no remunerados y generan el auxilio por incapacidad.
// Retención en la fuente: tabla REAL Art. 383 ET (procedimiento 1) — los tramos en UVT son ley
// estable; el valor del UVT en pesos lo fija el tenant (NominaParametro, DIAN lo publica cada
// año). Simplificación declarada: no modela deducciones adicionales (dependientes, intereses de
// vivienda) que un procedimiento 1 completo permitiría restar — mismo criterio de honestidad que
// el resto del proyecto (mejor aproximación real y documentada, nunca un placeholder falso).

export type ConceptoNominaTipo = "DEVENGADO" | "DEDUCCION" | "APORTE_PATRONAL" | "PRESTACION_SOCIAL"
export type FormulaConcepto =
  | "FIJO"
  | "PORCENTAJE_SUELDO"
  | "PORCENTAJE_IBC"
  | "PORCENTAJE_DEVENGADO"
  | "RETENCION_FUENTE"
  | "AUXILIO_INCAPACIDAD"

export interface ConceptoLiquidable {
  id: string
  tipo: ConceptoNominaTipo
  formula: FormulaConcepto
  porcentaje: number | null
  valorFijo: number | null
  constitutivoSalario: boolean
  orden: number
}

/** Efecto de las ausencias del periodo sobre la liquidación de un funcionario. */
export interface NovedadPeriodo {
  /** Días calendario del periodo (ej. 30). */
  diasPeriodo: number
  /** Días SIN remuneración dentro del periodo: licencia no remunerada + incapacidad desde el día 3. */
  diasNoRemunerados: number
  /** Días de incapacidad desde el día 3 (base del auxilio del 66.67%; los 2 primeros los paga el empleador al 100% dentro del sueldo normal). */
  diasIncapacidadPagable: number
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

// Art. 383 ET (procedimiento 1) — tramos en UVT, estables en la ley; el valor del UVT en pesos lo
// fija el tenant cada año (NominaParametro). tarifa/uvtBase aplican sobre el exceso del tramo.
const TRAMOS_RETENCION: { desde: number; hasta: number; tarifa: number; uvtBase: number }[] = [
  { desde: 0, hasta: 95, tarifa: 0, uvtBase: 0 },
  { desde: 95, hasta: 150, tarifa: 0.19, uvtBase: 0 },
  { desde: 150, hasta: 360, tarifa: 0.28, uvtBase: 10.4 },
  { desde: 360, hasta: 640, tarifa: 0.33, uvtBase: 69.4 },
  { desde: 640, hasta: 945, tarifa: 0.35, uvtBase: 161.6 },
  { desde: 945, hasta: 2300, tarifa: 0.37, uvtBase: 268.75 },
  { desde: 2300, hasta: Infinity, tarifa: 0.39, uvtBase: 770 },
]

/** Retención en la fuente mensual sobre una base gravable ya depurada (Art. 383 ET). */
export function calcularRetencionFuente(baseGravableMensual: number, uvt: number): number {
  if (uvt <= 0 || baseGravableMensual <= 0) return 0
  const baseUvt = baseGravableMensual / uvt
  const tramo = TRAMOS_RETENCION.find((t) => baseUvt >= t.desde && baseUvt < t.hasta) ?? TRAMOS_RETENCION[TRAMOS_RETENCION.length - 1]
  if (tramo.tarifa === 0) return 0
  const retencionUvt = tramo.uvtBase + (baseUvt - tramo.desde) * tramo.tarifa
  return redondear(retencionUvt * uvt)
}

function valorFormulaSimple(c: ConceptoLiquidable, salarioBasico: number, base: number, factorDias: number): number {
  switch (c.formula) {
    case "FIJO":
      return redondear((c.valorFijo ?? 0) * factorDias)
    case "PORCENTAJE_SUELDO":
      return redondear(salarioBasico * Number(c.porcentaje ?? 0) * factorDias)
    case "PORCENTAJE_IBC":
    case "PORCENTAJE_DEVENGADO":
      return redondear(base * Number(c.porcentaje ?? 0))
    default:
      return 0
  }
}

export function liquidar(
  salarioBasico: number,
  conceptos: ConceptoLiquidable[],
  opciones: { novedad?: NovedadPeriodo; uvt?: number } = {},
): ResultadoLiquidacion {
  const { novedad, uvt = 0 } = opciones
  const factorDias = novedad && novedad.diasPeriodo > 0
    ? Math.max(0, (novedad.diasPeriodo - novedad.diasNoRemunerados) / novedad.diasPeriodo)
    : 1

  const activos = [...conceptos].sort((a, b) => a.orden - b.orden)
  const lineas: LineaLiquidacion[] = []

  // 1) Devengados — prorrateados por días trabajados; el auxilio por incapacidad se calcula
  // aparte (66.67% de los días de incapacidad desde el día 3), no por porcentaje/fijo genérico.
  let totalDevengado = 0
  let ibc = 0
  for (const c of activos.filter((c) => c.tipo === "DEVENGADO")) {
    if (c.formula === "AUXILIO_INCAPACIDAD") {
      const dias = novedad?.diasIncapacidadPagable ?? 0
      if (dias <= 0) continue // sin incapacidad en el periodo, no genera línea vacía
      const valor = redondear((salarioBasico / 30) * dias * (2 / 3))
      lineas.push({ conceptoId: c.id, valor, base: null })
      totalDevengado += valor
      continue
    }
    const valor = valorFormulaSimple(c, salarioBasico, salarioBasico, factorDias)
    lineas.push({ conceptoId: c.id, valor, base: null })
    totalDevengado += valor
    if (c.constitutivoSalario) ibc += valor
  }

  // 2) Deducciones del empleado — salud/pensión/etc. primero; la retención en la fuente al final,
  // sobre el IBC menos los aportes obligatorios ya deducidos (asume que toda deducción previa a
  // la retención en el catálogo ES un aporte obligatorio — válido para el corte actual).
  let totalDeducciones = 0
  let aportesObligatoriosEmpleado = 0
  const conceptoRetencion = activos.find((c) => c.tipo === "DEDUCCION" && c.formula === "RETENCION_FUENTE")
  for (const c of activos.filter((c) => c.tipo === "DEDUCCION" && c.formula !== "RETENCION_FUENTE")) {
    const base = c.formula === "PORCENTAJE_IBC" ? ibc : c.formula === "PORCENTAJE_DEVENGADO" ? totalDevengado : salarioBasico
    const valor = valorFormulaSimple(c, salarioBasico, base, 1)
    lineas.push({ conceptoId: c.id, valor, base })
    totalDeducciones += valor
    aportesObligatoriosEmpleado += valor
  }
  if (conceptoRetencion) {
    const baseTrasAportes = Math.max(0, ibc - aportesObligatoriosEmpleado)
    const rentaExenta = Math.min(baseTrasAportes * 0.25, uvt * 240)
    const baseGravable = Math.max(0, baseTrasAportes - rentaExenta)
    const valor = calcularRetencionFuente(baseGravable, uvt)
    lineas.push({ conceptoId: conceptoRetencion.id, valor, base: baseGravable })
    totalDeducciones += valor
  }

  // 3) Aportes patronales + prestaciones sociales — gasto/provisión de la entidad, no tocan el neto.
  let totalAportesPatronales = 0
  for (const c of activos.filter((c) => c.tipo === "APORTE_PATRONAL" || c.tipo === "PRESTACION_SOCIAL")) {
    const base = c.formula === "PORCENTAJE_IBC" ? ibc : salarioBasico
    const valor = valorFormulaSimple(c, salarioBasico, base, 1)
    lineas.push({ conceptoId: c.id, valor, base })
    totalAportesPatronales += valor
  }

  const netoPagar = redondear(totalDevengado - totalDeducciones)
  return { ibc, totalDevengado, totalDeducciones, totalAportesPatronales, netoPagar, lineas }
}

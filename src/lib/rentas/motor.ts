// Motor de liquidación de Rentas. Funciones PURAS (sin BD) — mismo criterio que nomina/motor.ts:
// el código no adivina reglas, solo aplica la tabla tarifaria que el tenant ya cargó.
//
// Simplificación legal declarada (no placeholder falso): el predial NO aplica el tope de
// incremento anual (Ley 44/1990 Art. 6, requiere el valor liquidado el año anterior) ni
// descuentos por pronto pago — ambos son ajustes sobre este valor base, correctamente calculado,
// que quedan para un siguiente incremento.

export interface TarifaPredial {
  destino: string
  avaluoDesde: number
  avaluoHasta: number | null
  tarifaXMil: number
}

export interface ResultadoLiquidacion {
  tarifaAplicada: number
  valor: number
}

/** Busca la tarifa vigente para un destino+avalúo dentro de la tabla del tenant (rango cerrado-abierto). */
export function buscarTarifaPredial(avaluoCatastral: number, destino: string, tarifas: TarifaPredial[]): TarifaPredial | null {
  return (
    tarifas.find(
      (t) =>
        t.destino === destino &&
        avaluoCatastral >= t.avaluoDesde &&
        (t.avaluoHasta === null || avaluoCatastral < t.avaluoHasta),
    ) ?? null
  )
}

/** Predial = avalúo catastral × tarifa por mil de la tabla del Acuerdo Municipal vigente. */
export function liquidarPredial(avaluoCatastral: number, destino: string, tarifas: TarifaPredial[]): ResultadoLiquidacion | null {
  const tarifa = buscarTarifaPredial(avaluoCatastral, destino, tarifas)
  if (!tarifa) return null
  const valor = Math.round((avaluoCatastral * tarifa.tarifaXMil) / 1000)
  return { tarifaAplicada: tarifa.tarifaXMil, valor }
}

/** ICA = ingresos brutos declarados × tarifa por mil de la actividad económica registrada. */
export function liquidarIca(ingresosBrutos: number, tarifaXMil: number): ResultadoLiquidacion {
  const valor = Math.round((ingresosBrutos * tarifaXMil) / 1000)
  return { tarifaAplicada: tarifaXMil, valor }
}

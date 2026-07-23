import type { NovedadPeriodo } from "./motor"

// Traduce las Ausencias de RRHH (VACACIONES/LICENCIA/COMISION/INCAPACIDAD) al efecto que tienen
// sobre la liquidación de un periodo. VACACIONES y COMISION son remuneradas (no reducen nada).
// LICENCIA se asume no remunerada (reduce días trabajados). INCAPACIDAD: los primeros 2 días los
// paga el empleador al 100% dentro del sueldo normal (Ley 100/1993 Art. 227); desde el día 3 se
// reemplaza por el auxilio del 66.67% — y esos días SÍ salen del sueldo normal. El conteo del
// "día 3" es sobre la incapacidad COMPLETA (puede empezar antes del periodo), no sobre el periodo.

export interface AusenciaLike {
  tipo: string
  desde: Date
  hasta: Date
}

const MS_DIA = 24 * 60 * 60 * 1000

function diasInclusive(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / MS_DIA) + 1
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_DIA)
}

/** Intersección de dos rangos de fechas cerrados; null si no se solapan. */
function interseccion(aDesde: Date, aHasta: Date, bDesde: Date, bHasta: Date): [Date, Date] | null {
  const desde = aDesde > bDesde ? aDesde : bDesde
  const hasta = aHasta < bHasta ? aHasta : bHasta
  return desde <= hasta ? [desde, hasta] : null
}

export function calcularNovedadPeriodo(ausencias: AusenciaLike[], periodoInicio: Date, periodoFin: Date): NovedadPeriodo {
  const diasPeriodo = diasInclusive(periodoInicio, periodoFin)
  let diasNoRemunerados = 0
  let diasIncapacidadPagable = 0

  for (const a of ausencias) {
    if (a.tipo === "LICENCIA") {
      const rango = interseccion(a.desde, a.hasta, periodoInicio, periodoFin)
      if (rango) diasNoRemunerados += diasInclusive(rango[0], rango[1])
    } else if (a.tipo === "INCAPACIDAD") {
      const inicioPagable = sumarDias(a.desde, 2) // día 3 de la incapacidad en adelante
      if (inicioPagable > a.hasta) continue // incapacidad de 1-2 días: la paga completa el empleador
      const rango = interseccion(inicioPagable, a.hasta, periodoInicio, periodoFin)
      if (rango) {
        const dias = diasInclusive(rango[0], rango[1])
        diasNoRemunerados += dias
        diasIncapacidadPagable += dias
      }
    }
    // VACACIONES y COMISION son remuneradas — no reducen nada.
  }

  return { diasPeriodo, diasNoRemunerados, diasIncapacidadPagable }
}

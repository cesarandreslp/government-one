// Motor de Cobro Coactivo. Función PURA (sin BD) — mismo criterio que nomina/motor.ts y
// rentas/motor.ts: solo aritmética, sin tocar la base de datos.

export interface Cuota {
  numero: number
  fechaVencimiento: Date
  valor: number
}

function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, fecha.getUTCDate()))
  return d
}

/**
 * Reparte el saldo en N cuotas iguales (redondeadas hacia abajo al peso); la ÚLTIMA cuota absorbe
 * el residuo de redondeo para que la suma exacta de las cuotas sea siempre igual al saldo.
 */
export function calcularCuotas(saldo: number, numeroCuotas: number, fechaPrimeraCuota: Date): Cuota[] {
  if (numeroCuotas < 1) throw new Error("El número de cuotas debe ser al menos 1.")
  const base = Math.floor(saldo / numeroCuotas)
  const cuotas: Cuota[] = []
  let acumulado = 0
  for (let n = 1; n <= numeroCuotas; n++) {
    const esUltima = n === numeroCuotas
    const valor = esUltima ? saldo - acumulado : base
    acumulado += valor
    cuotas.push({ numero: n, fechaVencimiento: sumarMeses(fechaPrimeraCuota, n - 1), valor })
  }
  return cuotas
}

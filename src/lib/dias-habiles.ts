// Cálculo de días hábiles para términos de ley (PQRSD). Por ahora excluye solo fines de semana;
// los FESTIVOS colombianos (Ley 51/1983) quedan pendientes (catálogo nacional a incorporar, como
// CCPET/CGC). Sin dependencias externas.

/** ¿Es fin de semana? (0 = domingo, 6 = sábado). */
function esFinDeSemana(d: Date): boolean {
  const dia = d.getUTCDay()
  return dia === 0 || dia === 6
}

/** Suma `n` días hábiles a `desde` (excluye fines de semana). Devuelve una fecha nueva. */
export function sumarDiasHabiles(desde: Date, n: number): Date {
  const d = new Date(desde)
  let restantes = n
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (!esFinDeSemana(d)) restantes--
  }
  return d
}

/** Días hábiles restantes entre hoy y una fecha de vencimiento (negativo = vencido). */
export function diasHabilesRestantes(vencimiento: Date, ahora: Date = new Date()): number {
  const fin = new Date(vencimiento)
  const ini = new Date(ahora)
  const signo = fin >= ini ? 1 : -1
  const [a, b] = signo === 1 ? [ini, fin] : [fin, ini]
  let dias = 0
  const cur = new Date(a)
  while (cur < b) {
    cur.setUTCDate(cur.getUTCDate() + 1)
    if (!esFinDeSemana(cur)) dias++
  }
  return signo * dias
}

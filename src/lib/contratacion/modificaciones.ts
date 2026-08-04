// Adiciones y prórrogas: Contrato.valorContrato/plazoDias se mantienen como el valor ORIGINAL
// (inmutable) — el valor/plazo VIGENTE se deriva sumando las modificaciones insert-only. Función
// pura (sin BD) para poder probarla igual que puedeAvanzarContrato.

export interface ModificacionParaCalculo {
  valorAdicion: number | null
  diasProrroga: number | null
}

export function valorVigente(valorOriginal: number, modificaciones: ModificacionParaCalculo[]): number {
  return valorOriginal + modificaciones.reduce((s, m) => s + (m.valorAdicion ?? 0), 0)
}

export function plazoVigente(plazoOriginal: number | null, modificaciones: ModificacionParaCalculo[]): number | null {
  if (plazoOriginal === null) return null
  return plazoOriginal + modificaciones.reduce((s, m) => s + (m.diasProrroga ?? 0), 0)
}

/**
 * Ley 80/1993 art. 40 parágrafo: las adiciones en dinero de un contrato no podrán superar el 50%
 * de su valor inicial (expresado en salarios mínimos). Devuelve un mensaje de error si la nueva
 * adición haría que el acumulado supere ese tope, o `null` si es válida.
 */
export function validarTopeAdicion(
  valorOriginal: number,
  adicionesExistentes: ModificacionParaCalculo[],
  nuevaAdicion: number,
): string | null {
  const acumuladoPrevio = adicionesExistentes.reduce((s, m) => s + (m.valorAdicion ?? 0), 0)
  const tope = valorOriginal * 0.5
  if (acumuladoPrevio + nuevaAdicion > tope) {
    return `La adición supera el tope legal del 50% del valor inicial (Ley 80 art. 40 parágrafo): acumulado $${(acumuladoPrevio + nuevaAdicion).toLocaleString("es-CO")} > tope $${tope.toLocaleString("es-CO")}.`
  }
  return null
}

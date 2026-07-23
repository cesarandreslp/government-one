import type { CandidatoCargo } from "./tipos"

// Prompt COMPARTIDO por todos los proveedores — solo cambia el transporte/formato de tool-use.

export const NINGUNO = "NINGUNO"

export function construirPrompt(descripcion: string, candidatos: CandidatoCargo[]): string {
  const lista = candidatos
    .map((c) => `- [id:${c.id}] ${c.depCodigo} · ${c.depNombre} — ${c.cargoNombre}. Funciones: ${c.funciones}`)
    .join("\n")
  return [
    "Un ciudadano radicó esta solicitud en la ventanilla única de una entidad pública colombiana:",
    "",
    `"${descripcion}"`,
    "",
    "Elige el ÚNICO cargo cuyas funciones describan de forma más directa y específica el tema de",
    "la solicitud. Si ninguno de los candidatos aplica con claridad, no elijas ninguno.",
    "",
    "Candidatos:",
    lista,
  ].join("\n")
}

export function nombreHerramienta(): string {
  return "elegir_cargo"
}

export function descripcionHerramienta(): string {
  return "Registra el cargo elegido para atender la solicitud del ciudadano."
}

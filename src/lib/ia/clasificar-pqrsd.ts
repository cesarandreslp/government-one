import type { CredencialIA, ProveedorIA } from "@/lib/tenant-secretos"
import type { CandidatoCargo } from "./tipos"
import { llamarAnthropic } from "./proveedores/anthropic"
import { llamarOpenAiCompatible, type ConfigOpenAiCompatible } from "./proveedores/openai-compatible"
import { llamarGemini } from "./proveedores/gemini"

export type { CandidatoCargo } from "./tipos"

// Clasificación de PQRSD por IA: dado el texto que escribió el ciudadano (sin dependencia ni
// cargo, solo el asunto en sus palabras), elige el CARGO cuyas `funciones` describan mejor el
// tema — así una pregunta sobre "línea de paramento" cae en el técnico de ordenamiento físico de
// Planeación, no en el fallback genérico de Atención al Ciudadano. Usa la credencial PROPIA del
// tenant (nunca una compartida de plataforma, ver tenant-secretos.ts) — cada tenant elige su
// proveedor según la cuenta que ya tenga (Anthropic, OpenAI, Groq, Gemini, Zhipu/z.ai). Degrada
// SIEMPRE a null ante cualquier falla (red, timeout, respuesta inesperada, proveedor caído) —
// jamás bloquea el radicado de una PQRSD real por un problema de IA.

const OPENAI_COMPATIBLES: Record<Exclude<ProveedorIA, "anthropic" | "gemini">, ConfigOpenAiCompatible> = {
  openai: { baseUrl: "https://api.openai.com/v1", modelo: "gpt-4o-mini" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", modelo: "llama-3.3-70b-versatile" },
  zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4", modelo: "glm-4-flash" },
}

/**
 * Devuelve el `id` del cargo candidato más competente para atender la solicitud, o `null` si
 * ninguno aplica con claridad (o si algo falla). Nunca lanza.
 */
export async function clasificarCargoPqrsd(
  descripcion: string,
  candidatos: CandidatoCargo[],
  credencial: CredencialIA,
): Promise<string | null> {
  if (candidatos.length === 0) return null

  const idsValidos = new Set(candidatos.map((c) => c.id))
  let eleccion: string | null = null

  if (credencial.proveedor === "anthropic") {
    eleccion = await llamarAnthropic(descripcion, candidatos, credencial.clave)
  } else if (credencial.proveedor === "gemini") {
    eleccion = await llamarGemini(descripcion, candidatos, credencial.clave)
  } else {
    const config = OPENAI_COMPATIBLES[credencial.proveedor]
    eleccion = await llamarOpenAiCompatible(config, descripcion, candidatos, credencial.clave)
  }

  if (!eleccion || !idsValidos.has(eleccion)) return null
  return eleccion
}

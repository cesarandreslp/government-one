import type { CredencialIA, ProveedorIA } from "@/lib/tenant-secretos"
import { generarTextoAnthropic } from "./proveedores/anthropic"
import { generarTextoOpenAiCompatible, type ConfigOpenAiCompatible } from "./proveedores/openai-compatible"
import { generarTextoGemini } from "./proveedores/gemini"

// Redacción de informes de supervisión contractual por IA. A diferencia de la clasificación de
// PQRSD (que degrada a null y sigue el flujo manual), aquí el texto generado ES el entregable —
// si la IA falla, la acción que llama a esto debe devolver un error explícito al usuario, no
// continuar en silencio con un informe vacío.

const OPENAI_COMPATIBLES: Record<Exclude<ProveedorIA, "anthropic" | "gemini">, ConfigOpenAiCompatible> = {
  openai: { baseUrl: "https://api.openai.com/v1", modelo: "gpt-4o-mini" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", modelo: "llama-3.3-70b-versatile" },
  zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4", modelo: "glm-4-flash" },
}

async function generarTexto(prompt: string, credencial: CredencialIA): Promise<string | null> {
  if (credencial.proveedor === "anthropic") return generarTextoAnthropic(prompt, credencial.clave)
  if (credencial.proveedor === "gemini") return generarTextoGemini(prompt, credencial.clave)
  return generarTextoOpenAiCompatible(OPENAI_COMPATIBLES[credencial.proveedor], prompt, credencial.clave)
}

/**
 * Informe de UNA actividad, en 1ra persona (habla el contratista), a partir de lo que describió.
 * Mínimo 3 párrafos de ~8 líneas. `null` si la IA no está disponible o falla.
 */
export async function redactarInformeActividad(
  actividadDescripcion: string,
  loQueHizo: string,
  credencial: CredencialIA,
): Promise<string | null> {
  const prompt = [
    "Eres un contratista del Estado colombiano redactando el informe de ejecución de una actividad",
    "de tu contrato, para presentarlo a tu supervisor. Escribe en PRIMERA PERSONA (habla el",
    "contratista: \"realicé\", \"efectué\", \"entregué\"), con buena ortografía y gramática, tono",
    "formal-administrativo pero claro. El informe debe tener MÍNIMO 3 párrafos, cada uno de",
    "aproximadamente 8 líneas, desarrollando en detalle el trabajo realizado, la metodología o",
    "forma de ejecución, y los resultados/entregables obtenidos. No inventes datos, cantidades ni",
    "fechas que no estén en la descripción — desarrolla y da forma profesional a lo que el",
    "contratista realmente describió, sin fabricar hechos nuevos.",
    "",
    `Actividad del contrato: "${actividadDescripcion}"`,
    "",
    `Lo que el contratista describió que hizo: "${loQueHizo}"`,
    "",
    "Devuelve ÚNICAMENTE el texto del informe (sin título, sin encabezados, sin listas).",
  ].join("\n")
  return generarTexto(prompt, credencial)
}

/**
 * Informe del supervisor sobre un informe YA aprobado — en 3ra persona, alternando ese estilo con
 * la mención explícita del nombre del contratista (ej. "el contratista Juan Pérez ejecutó...").
 * Consolida todas las actividades del informe. `null` si la IA no está disponible o falla.
 */
export async function redactarInformeSupervisor(
  nombreContratista: string,
  numeroContrato: string,
  actividades: Array<{ descripcion: string; textoContratista: string }>,
  credencial: CredencialIA,
): Promise<string | null> {
  const lista = actividades
    .map((a, i) => `${i + 1}. Actividad: "${a.descripcion}"\nInforme del contratista: "${a.textoContratista}"`)
    .join("\n\n")
  const prompt = [
    "Eres el supervisor de un contrato estatal colombiano, redactando tu informe de supervisión",
    `sobre el contrato ${numeroContrato}, ejecutado por el contratista ${nombreContratista}, tras`,
    "revisar y aprobar los informes de ejecución que él/ella presentó por cada actividad.",
    "",
    "Escribe en TERCERA PERSONA, alternando ese estilo con la mención explícita del nombre del",
    `contratista (ej. "el contratista ${nombreContratista} ejecutó..." en vez de solo "se`,
    'ejecutó..."). Con buena ortografía y gramática, tono formal-administrativo. Consolida y',
    "sintetiza el avance de TODAS las actividades listadas abajo en un solo informe coherente,",
    "confirmando que fueron ejecutadas satisfactoriamente. No inventes datos que no estén en los",
    "informes del contratista.",
    "",
    "Actividades e informes del contratista:",
    lista,
    "",
    "Devuelve ÚNICAMENTE el texto del informe del supervisor (sin título, sin encabezados).",
  ].join("\n")
  return generarTexto(prompt, credencial)
}

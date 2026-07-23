import "server-only"

// Clasificación de PQRSD por IA: dado el texto que escribió el ciudadano (sin dependencia ni
// cargo, solo el asunto en sus palabras), elige el CARGO cuyas `funciones` describan mejor el
// tema — así una pregunta sobre "línea de paramento" cae en el técnico de ordenamiento físico de
// Planeación, no en el fallback genérico de Atención al Ciudadano. Usa la clave de IA PROPIA del
// tenant (nunca una compartida de plataforma, ver tenant-secretos.ts). Degrada SIEMPRE a null
// ante cualquier falla (red, timeout, respuesta inesperada) — jamás bloquea el radicado de una
// PQRSD real por un problema de IA.

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
const MODELO = "claude-haiku-4-5-20251001"
const TIMEOUT_MS = 8000
const NINGUNO = "NINGUNO"

export interface CandidatoCargo {
  id: string
  depId: string
  depCodigo: string
  depNombre: string
  cargoNombre: string
  funciones: string
}

/**
 * Devuelve el `id` del cargo candidato más competente para atender la solicitud, o `null` si
 * ninguno aplica con claridad (o si algo falla). Nunca lanza.
 */
export async function clasificarCargoPqrsd(
  descripcion: string,
  candidatos: CandidatoCargo[],
  apiKey: string,
): Promise<string | null> {
  if (candidatos.length === 0) return null

  const idsValidos = new Set(candidatos.map((c) => c.id))
  const lista = candidatos
    .map((c) => `- [id:${c.id}] ${c.depCodigo} · ${c.depNombre} — ${c.cargoNombre}. Funciones: ${c.funciones}`)
    .join("\n")
  const prompt = [
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

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 200,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "elegir_cargo",
            description: "Registra el cargo elegido para atender la solicitud del ciudadano.",
            input_schema: {
              type: "object",
              properties: {
                cargoId: {
                  type: "string",
                  enum: [...candidatos.map((c) => c.id), NINGUNO],
                  description: `El id del cargo competente, o "${NINGUNO}" si ninguno aplica con claridad.`,
                },
              },
              required: ["cargoId"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "elegir_cargo" },
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      content?: Array<{ type: string; input?: { cargoId?: string } }>
    }
    const eleccion = data.content?.find((b) => b.type === "tool_use")?.input?.cargoId
    if (!eleccion || eleccion === NINGUNO || !idsValidos.has(eleccion)) return null
    return eleccion
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

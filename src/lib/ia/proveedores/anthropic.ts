import type { CandidatoCargo } from "../tipos"
import { construirPrompt, nombreHerramienta, descripcionHerramienta, NINGUNO } from "../prompt"

const API = "https://api.anthropic.com/v1/messages"
const MODELO = "claude-haiku-4-5-20251001"
const TIMEOUT_MS = 8000

export async function llamarAnthropic(
  descripcion: string,
  candidatos: CandidatoCargo[],
  apiKey: string,
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 200,
        temperature: 0,
        messages: [{ role: "user", content: construirPrompt(descripcion, candidatos) }],
        tools: [
          {
            name: nombreHerramienta(),
            description: descripcionHerramienta(),
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
        tool_choice: { type: "tool", name: nombreHerramienta() },
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { content?: Array<{ type: string; input?: { cargoId?: string } }> }
    return data.content?.find((b) => b.type === "tool_use")?.input?.cargoId ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

import type { CandidatoCargo } from "../tipos"
import { construirPrompt, nombreHerramienta, descripcionHerramienta, NINGUNO } from "../prompt"

// Adaptador compartido para las APIs "OpenAI-compatible" (mismo formato de chat.completions +
// function calling): OpenAI, Groq y Zhipu (z.ai/bigmodel.cn) exponen exactamente esta forma —
// solo cambian baseUrl, modelo y clave.

const TIMEOUT_MS = 8000

export interface ConfigOpenAiCompatible {
  baseUrl: string
  modelo: string
}

export async function llamarOpenAiCompatible(
  config: ConfigOpenAiCompatible,
  descripcion: string,
  candidatos: CandidatoCargo[],
  apiKey: string,
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.modelo,
        temperature: 0,
        messages: [{ role: "user", content: construirPrompt(descripcion, candidatos) }],
        tools: [
          {
            type: "function",
            function: {
              name: nombreHerramienta(),
              description: descripcionHerramienta(),
              parameters: {
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
          },
        ],
        tool_choice: { type: "function", function: { name: nombreHerramienta() } },
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>
    }
    const raw = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
    if (!raw) return null
    const parsed = JSON.parse(raw) as { cargoId?: string }
    return parsed.cargoId ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

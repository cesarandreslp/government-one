import type { CandidatoCargo } from "../tipos"
import { construirPrompt, nombreHerramienta, descripcionHerramienta, NINGUNO } from "../prompt"

const MODELO = "gemini-2.0-flash"
const TIMEOUT_MS = 8000

export async function llamarGemini(
  descripcion: string,
  candidatos: CandidatoCargo[],
  apiKey: string,
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: construirPrompt(descripcion, candidatos) }] }],
        tools: [
          {
            functionDeclarations: [
              {
                name: nombreHerramienta(),
                description: descripcionHerramienta(),
                parameters: {
                  type: "OBJECT",
                  properties: {
                    cargoId: {
                      type: "STRING",
                      enum: [...candidatos.map((c) => c.id), NINGUNO],
                      description: `El id del cargo competente, o "${NINGUNO}" si ninguno aplica con claridad.`,
                    },
                  },
                  required: ["cargoId"],
                },
              },
            ],
          },
        ],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [nombreHerramienta()] } },
        generationConfig: { temperature: 0 },
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ functionCall?: { args?: { cargoId?: string } } }> } }>
    }
    const parts = data.candidates?.[0]?.content?.parts ?? []
    for (const p of parts) {
      if (p.functionCall?.args?.cargoId) return p.functionCall.args.cargoId
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

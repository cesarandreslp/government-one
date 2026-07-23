"use client"

import { useActionState } from "react"
import { guardarSecretoIaAction, type SecretoState } from "./actions"
import type { ProveedorIA } from "@/lib/tenant-secretos"

const PROVEEDORES: { valor: ProveedorIA; etiqueta: string }[] = [
  { valor: "anthropic", etiqueta: "Anthropic (Claude)" },
  { valor: "openai", etiqueta: "OpenAI (ChatGPT)" },
  { valor: "groq", etiqueta: "Groq" },
  { valor: "gemini", etiqueta: "Google Gemini" },
  { valor: "zhipu", etiqueta: "Zhipu / z.ai (GLM)" },
]

// Credencial de IA del tenant — write-only: se guarda cifrada, nunca se vuelve a mostrar (ni
// siquiera parcialmente). Un tenant sin credencial configurada simplemente no usa clasificación
// por IA (degrada al ruteo determinístico existente, nunca bloquea nada). Cada tenant elige el
// proveedor según la cuenta que ya tenga — no hay uno "por defecto" de plataforma.
export function SecretoIa({
  tenantId,
  configurada,
  proveedorActual,
}: {
  tenantId: string
  configurada: boolean
  proveedorActual: ProveedorIA | null
}) {
  const [state, action, pending] = useActionState<SecretoState, FormData>(guardarSecretoIaAction, {})

  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <span className={`text-xs ${configurada ? "text-emerald-700" : "text-slate-400"}`}>
        {configurada ? `Configurada (${PROVEEDORES.find((p) => p.valor === proveedorActual)?.etiqueta ?? proveedorActual})` : "Sin configurar"}
      </span>
      <select
        name="proveedor"
        defaultValue={proveedorActual ?? "anthropic"}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {PROVEEDORES.map((p) => (
          <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
        ))}
      </select>
      <input
        type="password"
        name="valor"
        placeholder="clave de API…"
        autoComplete="off"
        className="w-56 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Guardando…" : configurada ? "Reemplazar" : "Guardar"}
      </button>
      {state.ok && <span className="text-xs text-emerald-700">✓ guardada</span>}
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  )
}

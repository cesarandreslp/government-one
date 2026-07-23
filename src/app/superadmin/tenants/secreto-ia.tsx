"use client"

import { useActionState } from "react"
import { guardarSecretoIaAction, type SecretoState } from "./actions"

// Clave de IA (Anthropic) del tenant — write-only: se guarda cifrada, nunca se vuelve a mostrar
// (ni siquiera parcialmente). Un tenant sin clave configurada simplemente no usa clasificación
// por IA (degrada al ruteo determinístico existente, nunca bloquea nada).
export function SecretoIa({ tenantId, configurada }: { tenantId: string; configurada: boolean }) {
  const [state, action, pending] = useActionState<SecretoState, FormData>(guardarSecretoIaAction, {})

  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <span className={`text-xs ${configurada ? "text-emerald-700" : "text-slate-400"}`}>
        Clave de IA: {configurada ? "configurada" : "sin configurar"}
      </span>
      <input
        type="password"
        name="valor"
        placeholder="sk-ant-…"
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

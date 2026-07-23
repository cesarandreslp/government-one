"use client"

import { useActionState } from "react"
import { actualizarNitAction, type NitState } from "./actions"

// NIT de la entidad — lo necesita Nómina para el archivo PILA (línea de aportante ante UGPP).
export function NitTenant({ tenantId, nit }: { tenantId: string; nit: string | null }) {
  const [state, action, pending] = useActionState<NitState, FormData>(actualizarNitAction, {})

  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input
        name="nit"
        defaultValue={nit ?? ""}
        placeholder="NIT (solo dígitos, sin DV)"
        className="w-48 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
      {state.ok && <span className="text-xs text-emerald-700">✓ guardado</span>}
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  )
}

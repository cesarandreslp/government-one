"use client"

import { useActionState } from "react"
import { asignarGrantsCargoAction, type AccionState } from "./actions"

interface ModuloCapacidades {
  id: string
  capacidades: string[]
}

// Editor de las CAPACIDADES (Capa 3) de un cargo. Solo se ofrecen los módulos ya asignados a la
// dependencia (Capa 2) — asignar una capacidad de un módulo que la dependencia no maneja no
// tendría efecto (funcionarioPuede exige las 3 capas). Ver ModulosDependencia para esa Capa 2.
export function GrantsCargo({
  cargoId,
  actuales,
  modulos,
}: {
  cargoId: string
  actuales: Record<string, string[]>
  modulos: ModuloCapacidades[]
}) {
  const [state, action, pending] = useActionState<AccionState, FormData>(asignarGrantsCargoAction, {})

  if (modulos.length === 0) {
    return <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">Sin módulos asignados a la dependencia — asígnalos arriba para poder dar capacidades.</p>
  }

  return (
    <form action={action} className="mt-2 border-t border-slate-100 pt-2">
      <input type="hidden" name="cargoId" value={cargoId} />
      <p className="mb-1 text-xs font-medium text-slate-500">Capacidades</p>
      <div className="space-y-1">
        {modulos.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs text-slate-400">{m.id}</span>
            {m.capacidades.map((cap) => {
              const valor = `${m.id}:${cap}`
              return (
                <label key={cap} className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" name="grants" value={valor} defaultChecked={(actuales[m.id] ?? []).includes(cap)} />
                  {cap}
                </label>
              )
            })}
          </div>
        ))}
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? "…" : "Guardar"}
        </button>
        {state.ok && <span className="text-xs text-emerald-700">✓</span>}
        {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      </div>
    </form>
  )
}

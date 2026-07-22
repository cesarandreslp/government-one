"use client"

import { useActionState } from "react"
import { asignarModulosDependenciaAction, type AccionState } from "./actions"

interface ModuloOpcion {
  id: string
  nombre: string
}

// Editor de los MÓDULOS que maneja una dependencia (admin del tenant). Solo aparecen los módulos
// DISPONIBLES para el tenant (base + contratados). Un funcionario opera un módulo solo si está
// asignado a su dependencia (+ su cargo confiere la capacidad).
export function ModulosDependencia({
  dependenciaId,
  asignados,
  disponibles,
}: {
  dependenciaId: string
  asignados: string[]
  disponibles: ModuloOpcion[]
}) {
  const [state, action, pending] = useActionState<AccionState, FormData>(asignarModulosDependenciaAction, {})
  const activos = new Set(asignados)

  return (
    <form action={action} className="mt-3 border-t border-slate-100 pt-2">
      <input type="hidden" name="dependenciaId" value={dependenciaId} />
      <p className="mb-1 text-xs font-medium text-slate-500">Módulos que maneja</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {disponibles.map((m) => (
          <label key={m.id} className="flex items-center gap-1 text-xs text-slate-600">
            <input type="checkbox" name="modulos" value={m.id} defaultChecked={activos.has(m.id)} />
            {m.nombre}
          </label>
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

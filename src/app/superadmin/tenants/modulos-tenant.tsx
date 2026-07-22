"use client"

import { useActionState } from "react"
import { actualizarModulosTenantAction, type ModulosState } from "./actions"

interface ModuloOpcion {
  id: string
  nombre: string
  categoria: string
}

// Editor de módulos CONTRATADOS de un tenant (superadmin). Los base están siempre activos y no
// aparecen aquí. Guarda con un submit (checkboxes → array `modulos`).
export function ModulosTenant({
  tenantId,
  contratados,
  contratables,
}: {
  tenantId: string
  contratados: string[]
  contratables: ModuloOpcion[]
}) {
  const [state, action, pending] = useActionState<ModulosState, FormData>(actualizarModulosTenantAction, {})
  const activos = new Set(contratados)

  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {contratables.map((m) => (
          <label key={m.id} className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" name="modulos" value={m.id} defaultChecked={activos.has(m.id)} />
            {m.nombre}
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar módulos"}
        </button>
        {state.ok && <span className="text-xs text-emerald-700">✓ guardado</span>}
        {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      </div>
    </form>
  )
}

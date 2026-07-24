"use client"

import { useActionState } from "react"
import { registrarPermisoAction, type RelLabState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

const inicial: RelLabState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: RelLabState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function RelLabAcciones({ puedeAdministrar, usuarios }: { puedeAdministrar: boolean; usuarios: Opcion[] }) {
  const [state, action, pending] = useActionState(registrarPermisoAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Registrar permiso sindical</h3>
      {usuarios.length === 0 ? (
        <p className="text-sm text-slate-400">No hay funcionarios registrados.</p>
      ) : (
        <form action={action} className="grid gap-2 sm:grid-cols-2">
          <select name="usuarioId" required defaultValue="" className={`${INPUT} sm:col-span-2`}>
            <option value="" disabled>— Funcionario —</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
          </select>
          <input name="fechaInicio" type="date" required className={INPUT} />
          <input name="fechaFin" type="date" required className={INPUT} />
          <input name="motivo" placeholder="Motivo" required className={`${INPUT} sm:col-span-2`} />
          <button type="submit" disabled={pending} className={`${BTN} sm:col-span-2`}>{pending ? "Guardando…" : "Registrar permiso"}</button>
        </form>
      )}
      <Mensaje state={state} />
    </div>
  )
}

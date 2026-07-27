"use client"

import { useActionState } from "react"
import { actualizarEstratoAction, type EstratState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeActualizar: boolean
  predios: Opcion[]
}

const inicial: EstratState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: EstratState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function EstratificacionAcciones({ puedeActualizar, predios }: Props) {
  const [state, action, pend] = useActionState(actualizarEstratoAction, inicial)

  if (!puedeActualizar) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Actualizar estrato</h3>
      {predios.length === 0 ? (
        <p className="text-sm text-slate-400">No hay predios registrados (se registran desde Rentas).</p>
      ) : (
        <form action={action} className="grid gap-2 md:grid-cols-2">
          <select name="predioId" required defaultValue="" className={`${INPUT} md:col-span-2`}>
            <option value="" disabled>— Predio —</option>
            {predios.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
          </select>
          <select name="estratoNuevo" required defaultValue="" className={INPUT}>
            <option value="" disabled>— Nuevo estrato —</option>
            {[1, 2, 3, 4, 5, 6].map((e) => <option key={e} value={e}>Estrato {e}</option>)}
          </select>
          <input name="fecha" type="date" required className={INPUT} />
          <textarea name="motivo" required rows={2} placeholder="Motivo del cambio (visita técnica, reclamación, actualización catastral...)" className={`${INPUT} md:col-span-2`} />
          <button type="submit" disabled={pend} className={`${BTN} md:col-span-2`}>{pend ? "Actualizando…" : "Actualizar estrato"}</button>
        </form>
      )}
      <Mensaje state={state} />
    </div>
  )
}

"use client"

import { useActionState } from "react"
import { establecerAcuerdoAction, calificarAction, type EvalState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeEvaluar: boolean
  usuarios: Opcion[]
  pendientesCalificar: Opcion[]
}

const inicial: EvalState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: EvalState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{titulo}</h3>
      {children}
    </div>
  )
}

export function EvaluacionAcciones({ puedeEvaluar, usuarios, pendientesCalificar }: Props) {
  const [acuerdoState, acuerdoAction, acuerdoPend] = useActionState(establecerAcuerdoAction, inicial)
  const [califState, califAction, califPend] = useActionState(calificarAction, inicial)

  if (!puedeEvaluar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tarjeta titulo="Establecer acuerdo de gestión">
        {usuarios.length === 0 ? (
          <p className="text-sm text-slate-400">No hay funcionarios registrados.</p>
        ) : (
          <form action={acuerdoAction} className="grid gap-2">
            <select name="usuarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Funcionario —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
            </select>
            <input name="periodo" placeholder="Periodo (ej. 2026 o 2026-1)" required className={INPUT} />
            <div className="grid grid-cols-2 gap-2">
              <input name="fechaInicio" type="date" required className={INPUT} />
              <input name="fechaFin" type="date" required className={INPUT} />
            </div>
            <textarea name="compromisos" required rows={3} placeholder="Compromisos / acuerdo de gestión del periodo" className={INPUT} />
            <p className="text-xs text-slate-400">El evaluador se deriva automáticamente del jefe inmediato del cargo vigente.</p>
            <button type="submit" disabled={acuerdoPend} className={BTN}>{acuerdoPend ? "Guardando…" : "Establecer acuerdo"}</button>
          </form>
        )}
        <Mensaje state={acuerdoState} />
      </Tarjeta>

      <Tarjeta titulo="Calificar">
        {pendientesCalificar.length === 0 ? (
          <p className="text-sm text-slate-400">No hay acuerdos pendientes de calificar.</p>
        ) : (
          <form action={califAction} className="grid gap-2">
            <select name="evaluacionId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Acuerdo de gestión —</option>
              {pendientesCalificar.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
            </select>
            <input name="calificacion" type="number" min="0" max="100" step="0.1" placeholder="Calificación (0-100)" required className={INPUT} />
            <textarea name="observaciones" rows={2} placeholder="Observaciones (opcional)" className={INPUT} />
            <p className="text-xs text-slate-400">≥90 Sobresaliente · ≥75 Destacado · ≥60 Satisfactorio · &lt;60 No satisfactorio.</p>
            <button type="submit" disabled={califPend} className={BTN}>{califPend ? "Calificando…" : "Calificar"}</button>
          </form>
        )}
        <Mensaje state={califState} />
      </Tarjeta>
    </div>
  )
}

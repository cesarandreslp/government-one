"use client"

import { useActionState } from "react"
import { radicarPublicoAction, consultarPublicoAction, type RadicarPublicoState, type ConsultaState } from "./actions"

const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
const ESTADO_LABEL: Record<string, string> = {
  RECIBIDA: "Recibida", ASIGNADA: "En asignación", EN_TRAMITE: "En trámite", RESPONDIDA: "Respondida", CERRADA: "Cerrada",
}

export function RadicarForm() {
  const [state, action, pending] = useActionState<RadicarPublicoState, FormData>(radicarPublicoAction, {})

  if (state.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
        <h3 className="text-sm font-semibold text-emerald-800">Radicado con éxito</h3>
        <p className="mt-2 text-sm text-emerald-700">
          Tu solicitud quedó registrada con el número:
        </p>
        <p className="mt-2 text-lg font-mono font-semibold text-emerald-900">{state.numero}</p>
        <p className="mt-2 text-xs text-emerald-700">Guarda este número para consultar el estado de tu solicitud.</p>
      </div>
    )
  }

  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Tipo de solicitud</span>
          <select name="tipo" defaultValue="PETICION" className={INPUT}>
            <option value="PETICION">Petición</option>
            <option value="QUEJA">Queja</option>
            <option value="RECLAMO">Reclamo</option>
            <option value="SUGERENCIA">Sugerencia</option>
            <option value="DENUNCIA">Denuncia</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Nombre completo</span>
          <input name="peticionarioNombre" required className={INPUT} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Correo (opcional)</span>
          <input name="peticionarioEmail" type="email" className={INPUT} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Teléfono (opcional)</span>
          <input name="peticionarioTelefono" className={INPUT} />
        </label>
      </div>
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">Asunto</span>
        <input name="asunto" required className={INPUT} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">Descripción de la solicitud</span>
        <textarea name="descripcion" required rows={5} className={INPUT} />
      </label>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending} className={BTN}>{pending ? "Radicando…" : "Radicar solicitud"}</button>
      </div>
    </form>
  )
}

export function ConsultaForm() {
  const [state, action, pending] = useActionState<ConsultaState, FormData>(consultarPublicoAction, {})
  const e = state.encontrada

  return (
    <div className="grid gap-3">
      <form action={action} className="flex gap-2">
        <input name="numero" placeholder="PQRSD-2026-000001" className={INPUT} />
        <button type="submit" disabled={pending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {pending ? "Consultando…" : "Consultar"}
        </button>
      </form>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {e && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-slate-700">{e.numero}</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{ESTADO_LABEL[e.estado] ?? e.estado}</span>
          </div>
          <p className="mt-2 text-slate-500">Radicada el {e.fechaRecepcion} · vence el {e.fechaVencimiento}</p>
          {e.respuesta && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-800">Respuesta oficial</p>
              <p className="mt-1 whitespace-pre-wrap text-emerald-900">{e.respuesta}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

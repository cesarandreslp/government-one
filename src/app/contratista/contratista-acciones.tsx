"use client"

import { useActionState } from "react"
import { crearInformeAction, guardarActividadReporteAction, enviarInformeAction, type CtState } from "./actions"

interface Actividad { id: string; descripcion: string }
interface ActividadInforme { actividadId: string; descripcionContratista: string; evidenciaUrl: string | null; textoIA: string | null }
interface Informe {
  id: string; numero: number; periodo: string; estado: string; observaciones: string | null
  textoSupervisorIA: string | null; actividades: ActividadInforme[]
}
interface Props {
  contratoId: string
  actividades: Actividad[]
  informes: Informe[]
}

const inicial: CtState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: "bg-slate-100 text-slate-700",
  ENVIADO: "bg-amber-100 text-amber-800",
  DEVUELTO: "bg-red-100 text-red-700",
  APROBADO: "bg-emerald-100 text-emerald-800",
}

function Mensaje({ state }: { state: CtState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function ContratistaAcciones({ contratoId, actividades, informes }: Props) {
  const abierto = informes.find((i) => i.estado === "BORRADOR" || i.estado === "DEVUELTO")
  const [crearState, crearAction, crearPend] = useActionState(crearInformeAction, inicial)

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      {!abierto && (
        <form action={crearAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="contratoId" value={contratoId} />
          <input name="periodo" required placeholder="Período (ej. Agosto 2026)" className={`${INPUT} max-w-xs`} />
          <button type="submit" disabled={crearPend} className={BTN}>{crearPend ? "Creando…" : "Nuevo informe"}</button>
        </form>
      )}
      <Mensaje state={crearState} />

      {abierto && (
        <InformeAbierto informe={abierto} actividades={actividades} />
      )}

      {informes.filter((i) => i.id !== abierto?.id).length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Historial de informes</p>
          <ul className="space-y-2">
            {informes.filter((i) => i.id !== abierto?.id).map((i) => (
              <li key={i.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">N.° {i.numero} · {i.periodo}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${ESTADO_COLOR[i.estado]}`}>{i.estado}</span>
                </div>
                {i.observaciones && <p className="mt-1 text-slate-500">{i.observaciones}</p>}
                {i.textoSupervisorIA && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-slate-500">Ver informe del supervisor</summary>
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">{i.textoSupervisorIA}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function InformeAbierto({ informe, actividades }: { informe: Informe; actividades: Actividad[] }) {
  const [enviarState, enviarAction, enviarPend] = useActionState(enviarInformeAction, inicial)
  const reportePorActividad = new Map(informe.actividades.map((a) => [a.actividadId, a]))
  const todasReportadas = actividades.every((a) => reportePorActividad.get(a.id)?.textoIA)

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Informe N.° {informe.numero} · {informe.periodo}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[informe.estado]}`}>{informe.estado}</span>
      </div>
      {informe.estado === "DEVUELTO" && informe.observaciones && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Devuelto por el supervisor: {informe.observaciones}</p>
      )}

      <div className="space-y-3">
        {actividades.map((act) => (
          <ActividadForm key={act.id} informeId={informe.id} actividad={act} reporte={reportePorActividad.get(act.id) ?? null} />
        ))}
      </div>

      <form action={enviarAction} className="mt-3">
        <input type="hidden" name="informeId" value={informe.id} />
        <button type="submit" disabled={enviarPend || !todasReportadas} className={BTN}>
          {enviarPend ? "Enviando…" : todasReportadas ? "Enviar informe al supervisor" : "Reporta todas las actividades para enviar"}
        </button>
      </form>
      <Mensaje state={enviarState} />
    </div>
  )
}

function ActividadForm({ informeId, actividad, reporte }: { informeId: string; actividad: Actividad; reporte: ActividadInforme | null }) {
  const [state, action, pend] = useActionState(guardarActividadReporteAction, inicial)

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium text-slate-700">{actividad.descripcion}</p>
      <form action={action} className="mt-2 grid gap-2">
        <input type="hidden" name="informeId" value={informeId} />
        <input type="hidden" name="actividadId" value={actividad.id} />
        <textarea
          name="descripcionContratista" required minLength={15} rows={3}
          defaultValue={reporte?.descripcionContratista ?? ""}
          placeholder="Describe qué hiciste para cumplir esta actividad (la IA redactará el informe formal a partir de esto)"
          className={INPUT}
        />
        <input name="evidenciaUrl" defaultValue={reporte?.evidenciaUrl ?? ""} placeholder="URL de evidencia (opcional)" className={INPUT} />
        <button type="submit" disabled={pend} className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {pend ? "Redactando con IA…" : reporte?.textoIA ? "Regenerar informe" : "Redactar informe con IA"}
        </button>
      </form>
      <Mensaje state={state} />
      {reporte?.textoIA && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Informe redactado</p>
          <p className="whitespace-pre-wrap">{reporte.textoIA}</p>
        </div>
      )}
    </div>
  )
}

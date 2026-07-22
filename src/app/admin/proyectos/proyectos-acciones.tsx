"use client"

import { useActionState, useEffect, useState } from "react"
import { crearProyectoAction, crearHitoAction, reportarAvanceAction, type BpState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  puedeReportarAvance: boolean
  dependencias: Opcion[]
  proyectos: Opcion[]
  hitos: Opcion[]
}

const inicial: BpState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const ANIO_ACTUAL = new Date().getFullYear()

function Mensaje({ state }: { state: BpState }) {
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

function useResetTrasExito(state: BpState, reset: () => void) {
  useEffect(() => {
    if (state.ok) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}

export function ProyectosAcciones({ puedeAdministrar, puedeReportarAvance, dependencias, proyectos, hitos }: Props) {
  const [proyState, proyAction, proyPend] = useActionState(crearProyectoAction, inicial)
  const [hitoState, hitoAction, hitoPend] = useActionState(crearHitoAction, inicial)
  const [avanceState, avanceAction, avancePend] = useActionState(reportarAvanceAction, inicial)

  const [proyForm, setProyForm] = useState({ nombre: "", descripcion: "", dependenciaId: "", vigencia: String(ANIO_ACTUAL), valorTotal: "" })
  const [hitoForm, setHitoForm] = useState({ proyectoId: "", nombre: "", pesoPorcentual: "" })
  const [avanceForm, setAvanceForm] = useState({ hitoId: "", avancePorcentual: "", evidenciaUrl: "", observacion: "" })

  useResetTrasExito(proyState, () => setProyForm({ nombre: "", descripcion: "", dependenciaId: "", vigencia: String(ANIO_ACTUAL), valorTotal: "" }))
  useResetTrasExito(hitoState, () => setHitoForm({ proyectoId: "", nombre: "", pesoPorcentual: "" }))
  useResetTrasExito(avanceState, () => setAvanceForm({ hitoId: "", avancePorcentual: "", evidenciaUrl: "", observacion: "" }))

  return (
    <div className="grid gap-4">
      {puedeAdministrar && (
        <div className="grid gap-4 md:grid-cols-2">
          <Tarjeta titulo="Nuevo proyecto">
            {dependencias.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas al menos una dependencia (sembrar estructura organizacional).</p>
            ) : (
              <form action={proyAction} className="grid gap-2">
                <input name="nombre" placeholder="Nombre del proyecto" required value={proyForm.nombre} onChange={(e) => setProyForm({ ...proyForm, nombre: e.target.value })} className={INPUT} />
                <select name="dependenciaId" required value={proyForm.dependenciaId} onChange={(e) => setProyForm({ ...proyForm, dependenciaId: e.target.value })} className={INPUT}>
                  <option value="" disabled>— Dependencia responsable —</option>
                  {dependencias.map((d) => (
                    <option key={d.id} value={d.id}>{d.etiqueta}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input name="vigencia" type="number" min="2000" max="2100" required value={proyForm.vigencia} onChange={(e) => setProyForm({ ...proyForm, vigencia: e.target.value })} className={INPUT} />
                  <input name="valorTotal" type="number" min="0" step="0.01" placeholder="Valor total (opcional)" value={proyForm.valorTotal} onChange={(e) => setProyForm({ ...proyForm, valorTotal: e.target.value })} className={INPUT} />
                </div>
                <textarea name="descripcion" placeholder="Descripción (opcional)" value={proyForm.descripcion} onChange={(e) => setProyForm({ ...proyForm, descripcion: e.target.value })} className={INPUT} rows={2} />
                <button type="submit" disabled={proyPend} className={BTN}>{proyPend ? "Creando…" : "Crear proyecto"}</button>
              </form>
            )}
            <Mensaje state={proyState} />
          </Tarjeta>

          <Tarjeta titulo="Nuevo hito">
            {proyectos.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas al menos un proyecto.</p>
            ) : (
              <form action={hitoAction} className="grid gap-2">
                <select name="proyectoId" required value={hitoForm.proyectoId} onChange={(e) => setHitoForm({ ...hitoForm, proyectoId: e.target.value })} className={INPUT}>
                  <option value="" disabled>— Proyecto —</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>{p.etiqueta}</option>
                  ))}
                </select>
                <input name="nombre" placeholder="Nombre del hito" required value={hitoForm.nombre} onChange={(e) => setHitoForm({ ...hitoForm, nombre: e.target.value })} className={INPUT} />
                <input name="pesoPorcentual" type="number" min="1" max="100" step="0.01" placeholder="Peso % dentro del proyecto" required value={hitoForm.pesoPorcentual} onChange={(e) => setHitoForm({ ...hitoForm, pesoPorcentual: e.target.value })} className={INPUT} />
                <button type="submit" disabled={hitoPend} className={BTN}>{hitoPend ? "Creando…" : "Crear hito"}</button>
              </form>
            )}
            <Mensaje state={hitoState} />
          </Tarjeta>
        </div>
      )}

      {puedeReportarAvance && (
        <Tarjeta titulo="Reportar avance físico">
          {hitos.length === 0 ? (
            <p className="text-sm text-slate-400">Necesitas al menos un hito.</p>
          ) : (
            <form action={avanceAction} className="grid gap-2">
              <select name="hitoId" required value={avanceForm.hitoId} onChange={(e) => setAvanceForm({ ...avanceForm, hitoId: e.target.value })} className={INPUT}>
                <option value="" disabled>— Hito —</option>
                {hitos.map((h) => (
                  <option key={h.id} value={h.id}>{h.etiqueta}</option>
                ))}
              </select>
              <input name="avancePorcentual" type="number" min="0" max="100" step="0.01" placeholder="Avance % (0-100)" required value={avanceForm.avancePorcentual} onChange={(e) => setAvanceForm({ ...avanceForm, avancePorcentual: e.target.value })} className={INPUT} />
              <input name="evidenciaUrl" placeholder="URL de evidencia (opcional)" value={avanceForm.evidenciaUrl} onChange={(e) => setAvanceForm({ ...avanceForm, evidenciaUrl: e.target.value })} className={INPUT} />
              <textarea name="observacion" placeholder="Observación (opcional)" value={avanceForm.observacion} onChange={(e) => setAvanceForm({ ...avanceForm, observacion: e.target.value })} className={INPUT} rows={2} />
              <button type="submit" disabled={avancePend} className={BTN}>{avancePend ? "Reportando…" : "Reportar avance"}</button>
            </form>
          )}
          <Mensaje state={avanceState} />
        </Tarjeta>
      )}
    </div>
  )
}

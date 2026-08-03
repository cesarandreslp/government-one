"use client"

import { useActionState } from "react"
import { crearSesionAction, crearAcuerdoAction, marcarAcuerdoCumplidoAction, type ConvivState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  sesiones: Opcion[]
  acuerdosPendientes: Opcion[]
}

const inicial: ConvivState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: ConvivState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function ConvivenciaAcciones({ puedeAdministrar, sesiones, acuerdosPendientes }: Props) {
  const [stSesion, actSesion, pendSesion] = useActionState(crearSesionAction, inicial)
  const [stAcuerdo, actAcuerdo, pendAcuerdo] = useActionState(crearAcuerdoAction, inicial)
  const [stCumplido, actCumplido, pendCumplido] = useActionState(marcarAcuerdoCumplidoAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Nueva sesión del Consejo de Seguridad</h3>
        <form action={actSesion} className="grid gap-2">
          <input name="fecha" type="date" required className={INPUT} />
          <input name="tema" required placeholder="Tema de la sesión" className={INPUT} />
          <textarea name="resumen" rows={2} placeholder="Resumen (opcional)" className={INPUT} />
          <button type="submit" disabled={pendSesion} className={BTN}>{pendSesion ? "Registrando…" : "Registrar sesión"}</button>
        </form>
        <Mensaje state={stSesion} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Nuevo acuerdo</h3>
        {sesiones.length === 0 ? (
          <p className="text-sm text-slate-400">Registra primero una sesión.</p>
        ) : (
          <form action={actAcuerdo} className="grid gap-2">
            <select name="sesionId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Sesión —</option>
              {sesiones.map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
            </select>
            <input name="descripcion" required placeholder="Descripción del acuerdo" className={INPUT} />
            <input name="responsable" required placeholder="Responsable" className={INPUT} />
            <input name="plazo" type="date" className={INPUT} />
            <button type="submit" disabled={pendAcuerdo} className={BTN}>{pendAcuerdo ? "Registrando…" : "Registrar acuerdo"}</button>
          </form>
        )}
        <Mensaje state={stAcuerdo} />

        {acuerdosPendientes.length > 0 && (
          <form action={actCumplido} className="mt-4 grid gap-2 border-t border-slate-100 pt-3">
            <select name="acuerdoId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Acuerdo pendiente —</option>
              {acuerdosPendientes.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
            </select>
            <button type="submit" disabled={pendCumplido} className={BTN}>{pendCumplido ? "…" : "Marcar cumplido"}</button>
          </form>
        )}
        <Mensaje state={stCumplido} />
      </div>
    </div>
  )
}

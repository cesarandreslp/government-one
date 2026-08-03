"use client"

import { useActionState } from "react"
import { crearEmergenciaAction, registrarAyudaAction, cerrarEmergenciaAction, type GrdState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  emergenciasAbiertas: Opcion[]
}

const inicial: GrdState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const TIPOS = ["INUNDACION", "DESLIZAMIENTO", "INCENDIO_FORESTAL", "INCENDIO_ESTRUCTURAL", "VENDAVAL", "SISMO", "SEQUIA", "OTRO"]

function Mensaje({ state }: { state: GrdState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function GestionRiesgoAcciones({ puedeAdministrar, emergenciasAbiertas }: Props) {
  const [stEmg, actEmg, pendEmg] = useActionState(crearEmergenciaAction, inicial)
  const [stAyuda, actAyuda, pendAyuda] = useActionState(registrarAyudaAction, inicial)
  const [stCerrar, actCerrar, pendCerrar] = useActionState(cerrarEmergenciaAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Registrar emergencia</h3>
        <form action={actEmg} className="grid gap-2 md:grid-cols-2">
          <select name="tipoEvento" required defaultValue="" className={`${INPUT} md:col-span-2`}>
            <option value="" disabled>— Tipo de evento —</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}
          </select>
          <input name="fecha" type="date" required className={INPUT} />
          <input name="ubicacion" required placeholder="Ubicación (barrio/vereda)" className={INPUT} />
          <label className="text-xs text-slate-500">Familias afectadas<input name="familiasAfectadas" type="number" min={0} defaultValue={0} className={INPUT} /></label>
          <label className="text-xs text-slate-500">Personas afectadas<input name="personasAfectadas" type="number" min={0} defaultValue={0} className={INPUT} /></label>
          <textarea name="descripcion" rows={2} placeholder="Descripción (opcional)" className={`${INPUT} md:col-span-2`} />
          <button type="submit" disabled={pendEmg} className={`${BTN} md:col-span-2`}>{pendEmg ? "Registrando…" : "Registrar emergencia"}</button>
        </form>
        <Mensaje state={stEmg} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Registrar ayuda entregada</h3>
        {emergenciasAbiertas.length === 0 ? (
          <p className="text-sm text-slate-400">No hay emergencias en atención.</p>
        ) : (
          <form action={actAyuda} className="grid gap-2">
            <select name="emergenciaId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Emergencia —</option>
              {emergenciasAbiertas.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
            </select>
            <input name="tipoAyuda" required placeholder="Tipo de ayuda (mercado, kit de aseo, alojamiento…)" className={INPUT} />
            <input name="cantidad" required placeholder="Cantidad (ej. 20 mercados)" className={INPUT} />
            <input name="fechaEntrega" type="date" required className={INPUT} />
            <button type="submit" disabled={pendAyuda} className={BTN}>{pendAyuda ? "Registrando…" : "Registrar ayuda"}</button>
          </form>
        )}
        <Mensaje state={stAyuda} />

        {emergenciasAbiertas.length > 0 && (
          <form action={actCerrar} className="mt-4 grid gap-2 border-t border-slate-100 pt-3">
            <select name="emergenciaId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Emergencia a cerrar —</option>
              {emergenciasAbiertas.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
            </select>
            <button type="submit" disabled={pendCerrar} className={BTN}>{pendCerrar ? "…" : "Cerrar emergencia"}</button>
          </form>
        )}
        <Mensaje state={stCerrar} />
      </div>
    </div>
  )
}

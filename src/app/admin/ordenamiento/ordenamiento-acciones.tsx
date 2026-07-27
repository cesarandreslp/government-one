"use client"

import { useActionState } from "react"
import { radicarSolicitudAction, registrarActuacionAction, type OrdState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeTramitar: boolean
  terceros: Opcion[]
  predios: Opcion[]
  solicitudesAbiertas: Opcion[]
}

const inicial: OrdState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: OrdState }) {
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

export function OrdenamientoAcciones({ puedeTramitar, terceros, predios, solicitudesAbiertas }: Props) {
  const [radState, radAction, radPend] = useActionState(radicarSolicitudAction, inicial)
  const [actState, actAction, actPend] = useActionState(registrarActuacionAction, inicial)

  if (!puedeTramitar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tarjeta titulo="Radicar solicitud">
        {terceros.length === 0 ? (
          <p className="text-sm text-slate-400">No hay terceros registrados.</p>
        ) : (
          <form action={radAction} className="grid gap-2">
            <select name="tipo" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Tipo de trámite —</option>
              <option value="CONCEPTO_USO_SUELO">Concepto de uso de suelo</option>
              <option value="LINEA_PARAMENTO">Línea de paramento</option>
              <option value="LICENCIA_CONSTRUCCION">Licencia de construcción</option>
              <option value="LICENCIA_URBANIZACION">Licencia de urbanización</option>
              <option value="LICENCIA_SUBDIVISION">Licencia de subdivisión</option>
            </select>
            <select name="solicitanteId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Solicitante —</option>
              {terceros.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
            </select>
            <select name="predioId" defaultValue="" className={INPUT}>
              <option value="">— Predio (opcional, si ya está registrado en Rentas) —</option>
              {predios.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </select>
            <input name="direccion" required placeholder="Dirección del predio/proyecto" className={INPUT} />
            <textarea name="descripcion" required rows={2} placeholder="Descripción de la solicitud" className={INPUT} />
            <p className="text-xs text-slate-400">El término de ley se calcula automáticamente según el tipo de trámite.</p>
            <button type="submit" disabled={radPend} className={BTN}>{radPend ? "Radicando…" : "Radicar solicitud"}</button>
          </form>
        )}
        <Mensaje state={radState} />
      </Tarjeta>

      <Tarjeta titulo="Registrar actuación">
        {solicitudesAbiertas.length === 0 ? (
          <p className="text-sm text-slate-400">No hay solicitudes abiertas.</p>
        ) : (
          <form action={actAction} className="grid gap-2">
            <select name="solicitudId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Solicitud —</option>
              {solicitudesAbiertas.map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
            </select>
            <select name="estado" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Nuevo estado —</option>
              <option value="EN_REVISION">En revisión</option>
              <option value="REQUIERE_AJUSTES">Requiere ajustes</option>
              <option value="APROBADA">Aprobada</option>
              <option value="NEGADA">Negada</option>
            </select>
            <input name="fecha" type="date" required className={INPUT} />
            <textarea name="descripcion" required rows={2} placeholder="Descripción de la actuación (si el estado es Aprobada/Negada, este texto queda como el concepto de respuesta)" className={INPUT} />
            <button type="submit" disabled={actPend} className={BTN}>{actPend ? "Registrando…" : "Registrar actuación"}</button>
          </form>
        )}
        <Mensaje state={actState} />
      </Tarjeta>
    </div>
  )
}

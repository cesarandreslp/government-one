"use client"

import { useActionState } from "react"
import { radicarAction, crearSerieAction, crearSubserieAction, type GdState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeRadicar: boolean
  puedeTrd: boolean
  dependencias: Opcion[]
  series: Opcion[]
  subseries: Opcion[]
}

const inicial: GdState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: GdState }) {
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

export function GdAcciones({ puedeRadicar, puedeTrd, dependencias, series, subseries }: Props) {
  const [radState, radAction, radPend] = useActionState(radicarAction, inicial)
  const [serieState, serieAction, seriePend] = useActionState(crearSerieAction, inicial)
  const [subState, subAction, subPend] = useActionState(crearSubserieAction, inicial)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {puedeRadicar && (
        <Tarjeta titulo="Radicar documento">
          <form action={radAction} className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <select name="tipo" defaultValue="ENTRADA" className={INPUT}>
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
                <option value="INTERNO">Interno</option>
              </select>
              <input name="tercero" placeholder="Remitente / destinatario" className={INPUT} />
            </div>
            <input name="asunto" placeholder="Asunto" required className={INPUT} />
            <select name="dependenciaId" defaultValue="" className={INPUT}>
              <option value="">— Rutear a dependencia (opcional) —</option>
              {dependencias.map((d) => (
                <option key={d.id} value={d.id}>{d.etiqueta}</option>
              ))}
            </select>
            <select name="subserieId" defaultValue="" className={INPUT}>
              <option value="">— Clasificar en subserie TRD (opcional) —</option>
              {subseries.map((ss) => (
                <option key={ss.id} value={ss.id}>{ss.etiqueta}</option>
              ))}
            </select>
            <button type="submit" disabled={radPend} className={BTN}>{radPend ? "Radicando…" : "Radicar"}</button>
          </form>
          <Mensaje state={radState} />
        </Tarjeta>
      )}

      {puedeTrd && (
        <Tarjeta titulo="Nueva serie (TRD)">
          <form action={serieAction} className="grid gap-2">
            <select name="dependenciaId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Dependencia productora —</option>
              {dependencias.map((d) => (
                <option key={d.id} value={d.id}>{d.etiqueta}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input name="codigo" placeholder="Cód." required className={INPUT} />
              <input name="nombre" placeholder="Nombre de la serie" required className={`${INPUT} col-span-2`} />
            </div>
            <button type="submit" disabled={seriePend} className={BTN}>{seriePend ? "Creando…" : "Crear serie"}</button>
          </form>
          <Mensaje state={serieState} />
        </Tarjeta>
      )}

      {puedeTrd && (
        <Tarjeta titulo="Nueva subserie (TRD)">
          <form action={subAction} className="grid gap-2">
            <select name="serieId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Serie —</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.etiqueta}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input name="codigo" placeholder="Cód." required className={INPUT} />
              <input name="nombre" placeholder="Nombre de la subserie" required className={`${INPUT} col-span-2`} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input name="retencionGestion" type="number" min="0" placeholder="Ret. gestión" className={INPUT} />
              <input name="retencionCentral" type="number" min="0" placeholder="Ret. central" className={INPUT} />
              <select name="disposicion" defaultValue="" className={INPUT}>
                <option value="">Disposición…</option>
                <option value="CONSERVACION_TOTAL">Conservación total</option>
                <option value="ELIMINACION">Eliminación</option>
                <option value="SELECCION">Selección</option>
                <option value="DIGITALIZACION">Digitalización</option>
              </select>
            </div>
            <button type="submit" disabled={subPend} className={BTN}>{subPend ? "Creando…" : "Crear subserie"}</button>
          </form>
          <Mensaje state={subState} />
        </Tarjeta>
      )}
    </div>
  )
}

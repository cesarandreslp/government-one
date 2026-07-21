"use client"

import { useActionState } from "react"
import {
  sembrarClasificacionAction,
  crearApropiacionAction,
  expedirCdpAction,
  type PspState,
} from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  puedeExpedirCdp: boolean
  clasificacionVacia: boolean
  rubrosGasto: Opcion[]
}

const inicial: PspState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: PspState }) {
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

const ANIO_ACTUAL = new Date().getFullYear()

export function PresupuestoAcciones({ puedeAdministrar, puedeExpedirCdp, clasificacionVacia, rubrosGasto }: Props) {
  const [semState, semAction, semPend] = useActionState(sembrarClasificacionAction, inicial)
  const [aprState, aprAction, aprPend] = useActionState(crearApropiacionAction, inicial)
  const [cdpState, cdpAction, cdpPend] = useActionState(expedirCdpAction, inicial)

  return (
    <div className="grid gap-4">
      {puedeAdministrar && clasificacionVacia && (
        <Tarjeta titulo="Clasificación presupuestal">
          <p className="mb-3 text-sm text-slate-500">
            Siembra el CCPET (Catálogo de Clasificación Presupuestal Territorial, MinHacienda) para poder apropiar y expedir CDP.
          </p>
          <form action={semAction}>
            <button type="submit" disabled={semPend} className={BTN}>
              {semPend ? "Sembrando…" : "Sembrar clasificación CCPET"}
            </button>
          </form>
          <Mensaje state={semState} />
        </Tarjeta>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {puedeAdministrar && (
          <Tarjeta titulo="Nueva apropiación">
            {rubrosGasto.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas la clasificación sembrada primero.</p>
            ) : (
              <form action={aprAction} className="grid gap-2">
                <select name="rubroId" required defaultValue="" className={INPUT}>
                  <option value="" disabled>— Rubro de gasto —</option>
                  {rubrosGasto.map((r) => (
                    <option key={r.id} value={r.id}>{r.etiqueta}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input name="vigencia" type="number" min="2000" max="2100" defaultValue={ANIO_ACTUAL} required className={INPUT} />
                  <input name="apropiacionInicial" type="number" min="0" step="0.01" placeholder="Valor apropiado" required className={INPUT} />
                </div>
                <button type="submit" disabled={aprPend} className={BTN}>{aprPend ? "Guardando…" : "Guardar apropiación"}</button>
              </form>
            )}
            <Mensaje state={aprState} />
          </Tarjeta>
        )}

        {puedeExpedirCdp && (
          <Tarjeta titulo="Expedir CDP">
            {rubrosGasto.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas la clasificación sembrada primero.</p>
            ) : (
              <form action={cdpAction} className="grid gap-2">
                <select name="rubroId" required defaultValue="" className={INPUT}>
                  <option value="" disabled>— Rubro de gasto —</option>
                  {rubrosGasto.map((r) => (
                    <option key={r.id} value={r.id}>{r.etiqueta}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input name="vigencia" type="number" min="2000" max="2100" defaultValue={ANIO_ACTUAL} required className={INPUT} />
                  <input name="fecha" type="date" required className={INPUT} />
                </div>
                <input name="objeto" placeholder="Objeto del CDP" required className={INPUT} />
                <input name="valor" type="number" min="0" step="0.01" placeholder="Valor" required className={INPUT} />
                <button type="submit" disabled={cdpPend} className={BTN}>{cdpPend ? "Expidiendo…" : "Expedir CDP"}</button>
              </form>
            )}
            <Mensaje state={cdpState} />
          </Tarjeta>
        )}
      </div>
    </div>
  )
}

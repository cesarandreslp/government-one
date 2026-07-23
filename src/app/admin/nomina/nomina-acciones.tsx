"use client"

import { useActionState } from "react"
import { sembrarConceptosAction, crearPeriodoAction, liquidarPeriodoAction, pagarPeriodoAction, type NomState } from "./actions"

interface Opcion {
  id: string
  codigo?: string
  etiqueta?: string
}

interface Props {
  puedeLiquidar: boolean
  puedePagar: boolean
  hayConceptos: boolean
  periodosAbiertos: { id: string; codigo: string }[]
  periodosLiquidados: { id: string; codigo: string }[]
  cuentasBanco: Opcion[]
}

const inicial: NomState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: NomState }) {
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

export function NominaAcciones({ puedeLiquidar, puedePagar, hayConceptos, periodosAbiertos, periodosLiquidados, cuentasBanco }: Props) {
  const [semState, semAction, semPend] = useActionState(async () => sembrarConceptosAction(), inicial)
  const [perState, perAction, perPend] = useActionState(crearPeriodoAction, inicial)
  const [liqState, liqAction, liqPend] = useActionState(liquidarPeriodoAction, inicial)
  const [pagState, pagAction, pagPend] = useActionState(pagarPeriodoAction, inicial)

  if (!puedeLiquidar && !puedePagar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {puedeLiquidar && (
        <Tarjeta titulo="Catálogo de conceptos">
          <p className="mb-3 text-xs text-slate-500">
            Sueldo, prima, auxilio de transporte, aportes a salud/pensión/ARL/caja/ICBF/SENA y cesantías. Idempotente.
          </p>
          <form action={semAction}>
            <button type="submit" disabled={semPend} className={BTN}>{semPend ? "Sembrando…" : "Sembrar conceptos"}</button>
          </form>
          <Mensaje state={semState} />
        </Tarjeta>
      )}

      {puedeLiquidar && (
        <Tarjeta titulo="Nuevo periodo">
          <form action={perAction} className="grid gap-2">
            <input name="codigo" placeholder="AAAA-MM (ej. 2026-05)" required className={INPUT} />
            <button type="submit" disabled={perPend} className={BTN}>{perPend ? "Creando…" : "Crear periodo"}</button>
          </form>
          <Mensaje state={perState} />
        </Tarjeta>
      )}

      {puedeLiquidar && (
        <Tarjeta titulo="Liquidar periodo">
          {!hayConceptos ? (
            <p className="text-sm text-slate-400">Siembra el catálogo de conceptos primero.</p>
          ) : periodosAbiertos.length === 0 ? (
            <p className="text-sm text-slate-400">No hay periodos ABIERTOS.</p>
          ) : (
            <form action={liqAction} className="grid gap-2">
              <select name="periodoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Periodo —</option>
                {periodosAbiertos.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">Corre el motor para cada funcionario con salario vigente (lo fija RRHH).</p>
              <button type="submit" disabled={liqPend} className={BTN}>{liqPend ? "Liquidando…" : "Liquidar"}</button>
            </form>
          )}
          <Mensaje state={liqState} />
        </Tarjeta>
      )}

      {puedePagar && (
        <Tarjeta titulo="Pagar periodo">
          {periodosLiquidados.length === 0 ? (
            <p className="text-sm text-slate-400">No hay periodos LIQUIDADOS.</p>
          ) : (
            <form action={pagAction} className="grid gap-2">
              <select name="periodoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Periodo —</option>
                {periodosLiquidados.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo}</option>
                ))}
              </select>
              <select name="cuentaBancoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuenta de banco —</option>
                {cuentasBanco.map((c) => (
                  <option key={c.id} value={c.id}>{c.etiqueta}</option>
                ))}
              </select>
              <input name="fecha" type="date" required className={INPUT} />
              <p className="text-xs text-slate-400">Genera un comprobante contable agregado (gasto + pasivos + banco) para todo el periodo.</p>
              <button type="submit" disabled={pagPend} className={BTN}>{pagPend ? "Pagando…" : "Pagar y postear a Contabilidad"}</button>
            </form>
          )}
          <Mensaje state={pagState} />
        </Tarjeta>
      )}
    </div>
  )
}

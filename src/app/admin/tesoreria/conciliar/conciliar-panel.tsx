"use client"

import { useActionState } from "react"
import { conciliarAction, revertirConciliacionAction, type TesoState } from "../actions"

interface Asiento {
  asientoId: string
  fecha: string
  numero: string
  descripcion: string
  valor: number
}
interface Linea {
  id: string
  fecha: string
  descripcion: string
  referencia: string | null
  valor: number
}
interface Conciliado {
  asientoId: string
  numero: string
  descripcion: string
  valor: number
  lineas: string[]
}

interface Props {
  cuentaId: string
  asientosPendientes: Asiento[]
  lineasPendientes: Linea[]
  conciliados: Conciliado[]
}

const inicial: TesoState = {}
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function money(n: number): string {
  return `$${n.toLocaleString("es-CO")}`
}

function Mensaje({ state }: { state: TesoState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function ConciliarPanel({ cuentaId, asientosPendientes, lineasPendientes, conciliados }: Props) {
  const [state, action, pending] = useActionState(conciliarAction, inicial)
  const [revState, revAction, revPending] = useActionState(revertirConciliacionAction, inicial)

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Movimientos del libro mayor sin conciliar</h3>
          {asientosPendientes.length === 0 ? (
            <p className="text-sm text-slate-400">Todo conciliado.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
              {asientosPendientes.map((a) => (
                <li key={a.asientoId} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input type="radio" name="asientoId" value={a.asientoId} form="form-conciliar" required className="mt-1" />
                  <div>
                    <div className="text-xs text-slate-500">{a.fecha} · {a.numero}</div>
                    <div className="text-slate-800">{a.descripcion}</div>
                    <div className="font-mono text-xs font-medium text-slate-700">{money(a.valor)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Líneas del extracto sin conciliar</h3>
          {lineasPendientes.length === 0 ? (
            <p className="text-sm text-slate-400">No hay líneas pendientes en el periodo seleccionado.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
              {lineasPendientes.map((l) => (
                <li key={l.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input type="checkbox" name="extractoLineaIds" value={l.id} form="form-conciliar" className="mt-1" />
                  <div>
                    <div className="text-xs text-slate-500">{l.fecha} {l.referencia ? `· ${l.referencia}` : ""}</div>
                    <div className="text-slate-800">{l.descripcion}</div>
                    <div className="font-mono text-xs font-medium text-slate-700">{money(l.valor)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <form id="form-conciliar" action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="cuentaId" value={cuentaId} />
          <p className="text-xs text-slate-400">Selecciona un movimiento (izquierda) y una o más líneas del extracto (derecha) que sumen el mismo valor — tolerancia $1.</p>
          <button type="submit" disabled={pending} className={BTN}>{pending ? "Conciliando…" : "Conciliar"}</button>
        </form>
        <Mensaje state={state} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Conciliados recientes</h3>
        {conciliados.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay conciliaciones en esta cuenta.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {conciliados.map((c) => (
              <li key={c.asientoId} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="text-slate-800">{c.numero} · {c.descripcion}</div>
                  <div className="text-xs text-slate-500">{money(c.valor)} — {c.lineas.length} línea(s) de extracto</div>
                </div>
                <form action={revAction}>
                  <input type="hidden" name="asientoId" value={c.asientoId} />
                  <button type="submit" disabled={revPending} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60">
                    Revertir
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Mensaje state={revState} />
      </div>
    </div>
  )
}

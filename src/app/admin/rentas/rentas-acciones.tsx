"use client"

import { useActionState } from "react"
import {
  crearPredioAction,
  crearActividadAction,
  crearEstablecimientoAction,
  crearTarifaPredialAction,
  liquidarPredialAction,
  liquidarIcaAction,
  pagarLiquidacionAction,
  type RentaState,
} from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  puedeLiquidar: boolean
  puedeRecaudar: boolean
  terceros: Opcion[]
  predios: Opcion[]
  actividades: Opcion[]
  establecimientos: Opcion[]
  cuentasBanco: Opcion[]
  rubrosIngreso: Opcion[]
  liquidacionesPendientes: Opcion[]
}

const inicial: RentaState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: RentaState }) {
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

const DESTINOS = ["RESIDENCIAL", "COMERCIAL", "INDUSTRIAL", "RURAL", "LOTE_URBANIZABLE", "INSTITUCIONAL"]

export function RentasAcciones({ puedeAdministrar, puedeLiquidar, puedeRecaudar, terceros, predios, actividades, establecimientos, cuentasBanco, rubrosIngreso, liquidacionesPendientes }: Props) {
  const [predioState, predioAction, predioPend] = useActionState(crearPredioAction, inicial)
  const [actState, actAction, actPend] = useActionState(crearActividadAction, inicial)
  const [estState, estAction, estPend] = useActionState(crearEstablecimientoAction, inicial)
  const [tarState, tarAction, tarPend] = useActionState(crearTarifaPredialAction, inicial)
  const [liqPreState, liqPreAction, liqPrePend] = useActionState(liquidarPredialAction, inicial)
  const [liqIcaState, liqIcaAction, liqIcaPend] = useActionState(liquidarIcaAction, inicial)
  const [pagoState, pagoAction, pagoPend] = useActionState(pagarLiquidacionAction, inicial)

  if (!puedeAdministrar && !puedeLiquidar && !puedeRecaudar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {puedeAdministrar && (
        <Tarjeta titulo="Nuevo predio (predial)">
          {terceros.length === 0 ? (
            <p className="text-sm text-slate-400">No hay contribuyentes — crea un tercero desde Contabilidad primero.</p>
          ) : (
            <form action={predioAction} className="grid gap-2">
              <input name="numeroPredial" placeholder="Número predial / matrícula" required className={INPUT} />
              <select name="contribuyenteId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Contribuyente —</option>
                {terceros.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
              </select>
              <input name="direccion" placeholder="Dirección" required className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <select name="destino" required defaultValue="" className={INPUT}>
                  <option value="" disabled>— Destino —</option>
                  {DESTINOS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input name="estrato" type="number" min="1" max="6" placeholder="Estrato (opcional)" className={INPUT} />
              </div>
              <input name="avaluoCatastral" type="number" min="0" step="1" placeholder="Avalúo catastral" required className={INPUT} />
              <button type="submit" disabled={predioPend} className={BTN}>{predioPend ? "Registrando…" : "Registrar predio"}</button>
            </form>
          )}
          <Mensaje state={predioState} />
        </Tarjeta>
      )}

      {puedeAdministrar && (
        <Tarjeta titulo="Tarifa predial por vigencia (Acuerdo Municipal)">
          <form action={tarAction} className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input name="vigencia" type="number" placeholder="Vigencia (año)" required className={INPUT} />
              <select name="destino" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Destino —</option>
                {DESTINOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="avaluoDesde" type="number" min="0" step="1" placeholder="Avalúo desde" required className={INPUT} />
              <input name="avaluoHasta" type="number" min="0" step="1" placeholder="Avalúo hasta (vacío = sin tope)" className={INPUT} />
            </div>
            <input name="tarifaXMil" type="number" min="0" step="0.1" placeholder="Tarifa por mil (‰)" required className={INPUT} />
            <button type="submit" disabled={tarPend} className={BTN}>{tarPend ? "Guardando…" : "Registrar tarifa"}</button>
          </form>
          <Mensaje state={tarState} />
        </Tarjeta>
      )}

      {puedeAdministrar && (
        <Tarjeta titulo="Nueva actividad económica (ICA)">
          <form action={actAction} className="grid gap-2">
            <input name="codigo" placeholder="Código" required className={INPUT} />
            <input name="nombre" placeholder="Nombre de la actividad" required className={INPUT} />
            <input name="tarifaXMil" type="number" min="0" step="0.1" placeholder="Tarifa por mil (‰)" required className={INPUT} />
            <button type="submit" disabled={actPend} className={BTN}>{actPend ? "Guardando…" : "Registrar actividad"}</button>
          </form>
          <Mensaje state={actState} />
        </Tarjeta>
      )}

      {puedeAdministrar && (
        <Tarjeta titulo="Nuevo establecimiento (ICA)">
          {terceros.length === 0 || actividades.length === 0 ? (
            <p className="text-sm text-slate-400">Necesitas al menos un contribuyente y una actividad económica registrada.</p>
          ) : (
            <form action={estAction} className="grid gap-2">
              <select name="contribuyenteId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Contribuyente —</option>
                {terceros.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
              </select>
              <select name="actividadId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Actividad económica —</option>
                {actividades.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
              </select>
              <input name="nombreComercial" placeholder="Nombre comercial" required className={INPUT} />
              <input name="direccion" placeholder="Dirección" required className={INPUT} />
              <button type="submit" disabled={estPend} className={BTN}>{estPend ? "Registrando…" : "Registrar establecimiento"}</button>
            </form>
          )}
          <Mensaje state={estState} />
        </Tarjeta>
      )}

      {puedeLiquidar && (
        <Tarjeta titulo="Liquidar predial">
          {predios.length === 0 ? (
            <p className="text-sm text-slate-400">Registra un predio primero.</p>
          ) : (
            <form action={liqPreAction} className="grid gap-2">
              <select name="predioId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Predio —</option>
                {predios.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="vigencia" type="number" placeholder="Vigencia (año)" required className={INPUT} />
                <input name="fechaVencimiento" type="date" required className={INPUT} />
              </div>
              {rubrosIngreso.length > 0 && (
                <select name="rubroIngresoId" defaultValue="" className={INPUT}>
                  <option value="">— Rubro de ingreso (opcional) —</option>
                  {rubrosIngreso.map((r) => <option key={r.id} value={r.id}>{r.etiqueta}</option>)}
                </select>
              )}
              <p className="text-xs text-slate-400">Aplica la tarifa registrada para el destino y avalúo del predio en esa vigencia.</p>
              <button type="submit" disabled={liqPrePend} className={BTN}>{liqPrePend ? "Liquidando…" : "Liquidar"}</button>
            </form>
          )}
          <Mensaje state={liqPreState} />
        </Tarjeta>
      )}

      {puedeLiquidar && (
        <Tarjeta titulo="Liquidar ICA">
          {establecimientos.length === 0 ? (
            <p className="text-sm text-slate-400">Registra un establecimiento primero.</p>
          ) : (
            <form action={liqIcaAction} className="grid gap-2">
              <select name="establecimientoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Establecimiento —</option>
                {establecimientos.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
              </select>
              <input name="ingresosBrutos" type="number" min="0" step="1" placeholder="Ingresos brutos declarados" required className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <input name="vigencia" type="number" placeholder="Vigencia (año)" required className={INPUT} />
                <input name="fechaVencimiento" type="date" required className={INPUT} />
              </div>
              {rubrosIngreso.length > 0 && (
                <select name="rubroIngresoId" defaultValue="" className={INPUT}>
                  <option value="">— Rubro de ingreso (opcional) —</option>
                  {rubrosIngreso.map((r) => <option key={r.id} value={r.id}>{r.etiqueta}</option>)}
                </select>
              )}
              <button type="submit" disabled={liqIcaPend} className={BTN}>{liqIcaPend ? "Liquidando…" : "Liquidar"}</button>
            </form>
          )}
          <Mensaje state={liqIcaState} />
        </Tarjeta>
      )}

      {puedeRecaudar && (
        <Tarjeta titulo="Recaudar (pagar liquidación)">
          {liquidacionesPendientes.length === 0 ? (
            <p className="text-sm text-slate-400">No hay liquidaciones pendientes.</p>
          ) : cuentasBanco.length === 0 ? (
            <p className="text-sm text-slate-400">No hay cuentas bancarias en el plan de cuentas.</p>
          ) : (
            <form action={pagoAction} className="grid gap-2">
              <select name="liquidacionId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Liquidación —</option>
                {liquidacionesPendientes.map((l) => <option key={l.id} value={l.id}>{l.etiqueta}</option>)}
              </select>
              <select name="cuentaBancoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuenta de banco —</option>
                {cuentasBanco.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select name="medioPago" defaultValue="TRANSFERENCIA" className={INPUT}>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="OTRO">Otro</option>
                </select>
                <input name="fecha" type="date" required className={INPUT} />
              </div>
              <p className="text-xs text-slate-400">Postea un comprobante de ingreso real en Contabilidad (aparece automático en Tesorería).</p>
              <button type="submit" disabled={pagoPend} className={BTN}>{pagoPend ? "Registrando…" : "Registrar recaudo"}</button>
            </form>
          )}
          <Mensaje state={pagoState} />
        </Tarjeta>
      )}
    </div>
  )
}

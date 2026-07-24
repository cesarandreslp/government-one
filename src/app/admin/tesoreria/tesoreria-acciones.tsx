"use client"

import { useActionState } from "react"
import { crearCuentaAction, registrarMovimientoAction, cargarExtractoAction, type TesoState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  puedeConciliar: boolean
  cuentasContablesBanco: Opcion[]
  cuentasContablesTodas: Opcion[]
  cuentasTesoreria: Opcion[]
}

const inicial: TesoState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: TesoState }) {
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

export function TesoreriaAcciones({ puedeAdministrar, puedeConciliar, cuentasContablesBanco, cuentasContablesTodas, cuentasTesoreria }: Props) {
  const [cuentaState, cuentaAction, cuentaPend] = useActionState(crearCuentaAction, inicial)
  const [movState, movAction, movPend] = useActionState(registrarMovimientoAction, inicial)
  const [extState, extAction, extPend] = useActionState(cargarExtractoAction, inicial)

  if (!puedeAdministrar && !puedeConciliar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {puedeAdministrar && (
        <Tarjeta titulo="Nueva cuenta bancaria">
          {cuentasContablesBanco.length === 0 ? (
            <p className="text-sm text-slate-400">No hay cuentas contables de bancos (11xx) disponibles en el plan de cuentas.</p>
          ) : (
            <form action={cuentaAction} className="grid gap-2">
              <input name="nombre" placeholder="Nombre (ej. Cuenta corriente Bancolombia)" required className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <input name="banco" placeholder="Banco" required className={INPUT} />
                <input name="nitBanco" placeholder="NIT del banco (opcional)" className={INPUT} />
              </div>
              <input name="numeroCuenta" placeholder="Número de cuenta" required className={INPUT} />
              <select name="tipo" defaultValue="CORRIENTE" className={INPUT}>
                <option value="CORRIENTE">Corriente</option>
                <option value="AHORROS">Ahorros</option>
                <option value="INVERSION_TEMPORAL">Inversión temporal</option>
                <option value="FONDOS_ESPECIALES">Fondos especiales</option>
              </select>
              <select name="cuentaContableId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuenta contable (banco) —</option>
                {cuentasContablesBanco.map((c) => (
                  <option key={c.id} value={c.id}>{c.etiqueta}</option>
                ))}
              </select>
              <button type="submit" disabled={cuentaPend} className={BTN}>{cuentaPend ? "Creando…" : "Crear cuenta"}</button>
            </form>
          )}
          <Mensaje state={cuentaState} />
        </Tarjeta>
      )}

      {puedeAdministrar && (
        <Tarjeta titulo="Registrar movimiento (recaudo directo, rendimiento, traslado)">
          {cuentasTesoreria.length === 0 ? (
            <p className="text-sm text-slate-400">Crea una cuenta bancaria primero.</p>
          ) : (
            <form action={movAction} className="grid gap-2">
              <p className="text-xs text-slate-400">Postea un comprobante contable real — no un movimiento suelto.</p>
              <select name="cuentaId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuenta bancaria —</option>
                {cuentasTesoreria.map((c) => (
                  <option key={c.id} value={c.id}>{c.etiqueta}</option>
                ))}
              </select>
              <select name="tipo" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Tipo —</option>
                <option value="INGRESO">Ingreso (entra a la cuenta)</option>
                <option value="EGRESO">Egreso (sale de la cuenta)</option>
              </select>
              <select name="cuentaContraId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuenta contrapartida —</option>
                {cuentasContablesTodas.map((c) => (
                  <option key={c.id} value={c.id}>{c.etiqueta}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="valor" type="number" min="0" step="1" placeholder="Valor" required className={INPUT} />
                <input name="fecha" type="date" required className={INPUT} />
              </div>
              <input name="concepto" placeholder="Concepto" required className={INPUT} />
              <button type="submit" disabled={movPend} className={BTN}>{movPend ? "Registrando…" : "Registrar y postear"}</button>
            </form>
          )}
          <Mensaje state={movState} />
        </Tarjeta>
      )}

      {puedeConciliar && (
        <Tarjeta titulo="Cargar extracto bancario">
          {cuentasTesoreria.length === 0 ? (
            <p className="text-sm text-slate-400">Crea una cuenta bancaria primero.</p>
          ) : (
            <form action={extAction} className="grid gap-2">
              <select name="cuentaId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuenta bancaria —</option>
                {cuentasTesoreria.map((c) => (
                  <option key={c.id} value={c.id}>{c.etiqueta}</option>
                ))}
              </select>
              <input name="periodo" type="month" required className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <input name="saldoInicial" type="number" step="1" placeholder="Saldo inicial" required className={INPUT} />
                <input name="saldoFinal" type="number" step="1" placeholder="Saldo final" required className={INPUT} />
              </div>
              <textarea
                name="lineas"
                required
                rows={5}
                placeholder={"fecha,descripcion,referencia,debito,credito,saldo\n2026-07-05,Consignación,REF001,1500000,,1500000"}
                className={`${INPUT} font-mono text-xs`}
              />
              <p className="text-xs text-slate-400">Una línea por movimiento del extracto: fecha,descripción,referencia,débito,crédito,saldo.</p>
              <button type="submit" disabled={extPend} className={BTN}>{extPend ? "Cargando…" : "Cargar extracto"}</button>
            </form>
          )}
          <Mensaje state={extState} />
        </Tarjeta>
      )}
    </div>
  )
}

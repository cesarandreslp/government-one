"use client"

import { useActionState } from "react"
import { abrirProcesoAction, registrarActuacionAction, crearAcuerdoPagoAction, pagarCuotaAction, pagarTotalAction, type CoactivoState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeGestionar: boolean
  puedeRecaudar: boolean
  terceros: Opcion[]
  cuentasBanco: Opcion[]
  procesosAbiertos: Opcion[]
  procesosSinAcuerdo: Opcion[]
  cuotasPendientes: Opcion[]
}

const inicial: CoactivoState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: CoactivoState }) {
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

const TIPOS_ACTUACION = ["COBRO_PERSUASIVO", "MANDAMIENTO_PAGO", "MEDIDA_CAUTELAR", "TERMINACION", "OTRA"]

export function CoactivoAcciones({ puedeGestionar, puedeRecaudar, terceros, cuentasBanco, procesosAbiertos, procesosSinAcuerdo, cuotasPendientes }: Props) {
  const [abrirState, abrirAction, abrirPend] = useActionState(abrirProcesoAction, inicial)
  const [actState, actAction, actPend] = useActionState(registrarActuacionAction, inicial)
  const [acuerdoState, acuerdoAction, acuerdoPend] = useActionState(crearAcuerdoPagoAction, inicial)
  const [cuotaState, cuotaAction, cuotaPend] = useActionState(pagarCuotaAction, inicial)
  const [totalState, totalAction, totalPend] = useActionState(pagarTotalAction, inicial)

  if (!puedeGestionar && !puedeRecaudar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {puedeGestionar && (
        <Tarjeta titulo="Abrir proceso de cobro coactivo">
          {terceros.length === 0 ? (
            <p className="text-sm text-slate-400">No hay contribuyentes registrados.</p>
          ) : (
            <form action={abrirAction} className="grid gap-2">
              <select name="contribuyenteId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Contribuyente —</option>
                {terceros.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
              </select>
              <select name="tipo" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Impuesto —</option>
                <option value="PREDIAL">Predial</option>
                <option value="ICA">ICA</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="vigencia" type="number" placeholder="Vigencia (año)" required className={INPUT} />
                <input name="fecha" type="date" required className={INPUT} />
              </div>
              <p className="text-xs text-slate-400">Agrupa toda la cartera VENCIDA de ese contribuyente en ese impuesto.</p>
              <button type="submit" disabled={abrirPend} className={BTN}>{abrirPend ? "Abriendo…" : "Abrir proceso"}</button>
            </form>
          )}
          <Mensaje state={abrirState} />
        </Tarjeta>
      )}

      {puedeGestionar && (
        <Tarjeta titulo="Registrar actuación">
          {procesosAbiertos.length === 0 ? (
            <p className="text-sm text-slate-400">No hay procesos abiertos.</p>
          ) : (
            <form action={actAction} className="grid gap-2">
              <select name="procesoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Proceso —</option>
                {procesosAbiertos.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
              </select>
              <select name="tipo" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Tipo de actuación —</option>
                {TIPOS_ACTUACION.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input name="fecha" type="date" required className={INPUT} />
              <textarea name="descripcion" required rows={2} placeholder="Descripción de la actuación" className={INPUT} />
              <p className="text-xs text-slate-400">Mandamiento de pago y medida cautelar avanzan el estado del proceso; terminación sin pago anula la deuda (prescripción/remisión).</p>
              <button type="submit" disabled={actPend} className={BTN}>{actPend ? "Registrando…" : "Registrar actuación"}</button>
            </form>
          )}
          <Mensaje state={actState} />
        </Tarjeta>
      )}

      {puedeGestionar && (
        <Tarjeta titulo="Crear acuerdo de pago">
          {procesosSinAcuerdo.length === 0 ? (
            <p className="text-sm text-slate-400">No hay procesos elegibles (sin acuerdo previo).</p>
          ) : (
            <form action={acuerdoAction} className="grid gap-2">
              <select name="procesoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Proceso —</option>
                {procesosSinAcuerdo.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="numeroCuotas" type="number" min="1" max="36" placeholder="Número de cuotas" required className={INPUT} />
                <input name="fechaPrimeraCuota" type="date" required className={INPUT} />
              </div>
              <p className="text-xs text-slate-400">Reparte el saldo en cuotas mensuales iguales (la última absorbe el redondeo).</p>
              <button type="submit" disabled={acuerdoPend} className={BTN}>{acuerdoPend ? "Creando…" : "Crear acuerdo"}</button>
            </form>
          )}
          <Mensaje state={acuerdoState} />
        </Tarjeta>
      )}

      {puedeRecaudar && (
        <Tarjeta titulo="Pagar cuota">
          {cuotasPendientes.length === 0 || cuentasBanco.length === 0 ? (
            <p className="text-sm text-slate-400">No hay cuotas pendientes de pago.</p>
          ) : (
            <form action={cuotaAction} className="grid gap-2">
              <select name="cuotaId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuota —</option>
                {cuotasPendientes.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <select name="cuentaBancoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuenta de banco —</option>
                {cuentasBanco.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <input name="fecha" type="date" required className={INPUT} />
              <button type="submit" disabled={cuotaPend} className={BTN}>{cuotaPend ? "Registrando…" : "Pagar cuota"}</button>
            </form>
          )}
          <Mensaje state={cuotaState} />
        </Tarjeta>
      )}

      {puedeRecaudar && (
        <Tarjeta titulo="Pagar proceso completo">
          {procesosSinAcuerdo.length === 0 || cuentasBanco.length === 0 ? (
            <p className="text-sm text-slate-400">No hay procesos elegibles para pago total (sin acuerdo de pago).</p>
          ) : (
            <form action={totalAction} className="grid gap-2">
              <select name="procesoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Proceso —</option>
                {procesosSinAcuerdo.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
              </select>
              <select name="cuentaBancoId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Cuenta de banco —</option>
                {cuentasBanco.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <input name="fecha" type="date" required className={INPUT} />
              <button type="submit" disabled={totalPend} className={BTN}>{totalPend ? "Registrando…" : "Pagar todo"}</button>
            </form>
          )}
          <Mensaje state={totalState} />
        </Tarjeta>
      )}
    </div>
  )
}

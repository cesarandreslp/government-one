"use client"

import { useActionState, useEffect, useState } from "react"
import {
  sembrarClasificacionAction,
  crearApropiacionAction,
  expedirCdpAction,
  crearRpAction,
  crearObligacionAction,
  registrarPagoAction,
  type PspState,
} from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  puedeExpedirCdp: boolean
  puedeExpedirRp: boolean
  clasificacionVacia: boolean
  rubrosGasto: Opcion[]
  cdpsVigentes: Opcion[]
  rpsVigentes: Opcion[]
  obligacionesVigentes: Opcion[]
  terceros: Opcion[]
  cuentasGasto: Opcion[]
  cuentasBanco: Opcion[]
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

// Tras cada registro exitoso limpiamos el formulario por completo (selects incluidos) — un
// submit real puede caer en la navegación nativa en vez de la transición suave de React, y ahí
// el navegador restaura inputs de texto/número pero no <select>, dejando un estado confuso.
function useResetTrasExito(state: PspState, reset: () => void) {
  useEffect(() => {
    if (state.ok) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}

export function PresupuestoAcciones({
  puedeAdministrar, puedeExpedirCdp, puedeExpedirRp, clasificacionVacia,
  rubrosGasto, cdpsVigentes, rpsVigentes, obligacionesVigentes, terceros, cuentasGasto, cuentasBanco,
}: Props) {
  const [semState, semAction, semPend] = useActionState(sembrarClasificacionAction, inicial)
  const [aprState, aprAction, aprPend] = useActionState(crearApropiacionAction, inicial)
  const [cdpState, cdpAction, cdpPend] = useActionState(expedirCdpAction, inicial)
  const [rpState, rpAction, rpPend] = useActionState(crearRpAction, inicial)
  const [obState, obAction, obPend] = useActionState(crearObligacionAction, inicial)
  const [pagoState, pagoAction, pagoPend] = useActionState(registrarPagoAction, inicial)

  const [rpForm, setRpForm] = useState({ cdpId: "", terceroId: "", fecha: "", objeto: "", valor: "" })
  const [obForm, setObForm] = useState({ rpId: "", fecha: "", concepto: "", valor: "" })
  const [pagoForm, setPagoForm] = useState({ obligacionId: "", fecha: "", medioPago: "TRANSFERENCIA", referencia: "", cuentaGastoId: "", cuentaBancoId: "", valor: "" })

  useResetTrasExito(rpState, () => setRpForm({ cdpId: "", terceroId: "", fecha: "", objeto: "", valor: "" }))
  useResetTrasExito(obState, () => setObForm({ rpId: "", fecha: "", concepto: "", valor: "" }))
  useResetTrasExito(pagoState, () => setPagoForm({ obligacionId: "", fecha: "", medioPago: "TRANSFERENCIA", referencia: "", cuentaGastoId: "", cuentaBancoId: "", valor: "" }))

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

      {puedeExpedirRp && (
        <div className="grid gap-4 md:grid-cols-2">
          <Tarjeta titulo="Expedir RP (Registro Presupuestal)">
            {cdpsVigentes.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas al menos un CDP vigente.</p>
            ) : (
              <form action={rpAction} className="grid gap-2">
                <select name="cdpId" required value={rpForm.cdpId} onChange={(e) => setRpForm({ ...rpForm, cdpId: e.target.value })} className={INPUT}>
                  <option value="" disabled>— CDP —</option>
                  {cdpsVigentes.map((c) => (
                    <option key={c.id} value={c.id}>{c.etiqueta}</option>
                  ))}
                </select>
                <select name="terceroId" value={rpForm.terceroId} onChange={(e) => setRpForm({ ...rpForm, terceroId: e.target.value })} className={INPUT}>
                  <option value="">— Tercero (opcional) —</option>
                  {terceros.map((t) => (
                    <option key={t.id} value={t.id}>{t.etiqueta}</option>
                  ))}
                </select>
                <input name="fecha" type="date" required value={rpForm.fecha} onChange={(e) => setRpForm({ ...rpForm, fecha: e.target.value })} className={INPUT} />
                <input name="objeto" placeholder="Objeto del RP" required value={rpForm.objeto} onChange={(e) => setRpForm({ ...rpForm, objeto: e.target.value })} className={INPUT} />
                <input name="valor" type="number" min="0" step="0.01" placeholder="Valor" required value={rpForm.valor} onChange={(e) => setRpForm({ ...rpForm, valor: e.target.value })} className={INPUT} />
                <button type="submit" disabled={rpPend} className={BTN}>{rpPend ? "Expidiendo…" : "Expedir RP"}</button>
              </form>
            )}
            <Mensaje state={rpState} />
          </Tarjeta>

          <Tarjeta titulo="Registrar obligación">
            {rpsVigentes.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas al menos un RP vigente.</p>
            ) : (
              <form action={obAction} className="grid gap-2">
                <select name="rpId" required value={obForm.rpId} onChange={(e) => setObForm({ ...obForm, rpId: e.target.value })} className={INPUT}>
                  <option value="" disabled>— RP —</option>
                  {rpsVigentes.map((r) => (
                    <option key={r.id} value={r.id}>{r.etiqueta}</option>
                  ))}
                </select>
                <input name="fecha" type="date" required value={obForm.fecha} onChange={(e) => setObForm({ ...obForm, fecha: e.target.value })} className={INPUT} />
                <input name="concepto" placeholder="Concepto (bien/servicio recibido)" required value={obForm.concepto} onChange={(e) => setObForm({ ...obForm, concepto: e.target.value })} className={INPUT} />
                <input name="valor" type="number" min="0" step="0.01" placeholder="Valor" required value={obForm.valor} onChange={(e) => setObForm({ ...obForm, valor: e.target.value })} className={INPUT} />
                <button type="submit" disabled={obPend} className={BTN}>{obPend ? "Registrando…" : "Registrar obligación"}</button>
              </form>
            )}
            <Mensaje state={obState} />
          </Tarjeta>
        </div>
      )}

      {puedeExpedirRp && (
        <Tarjeta titulo="Registrar pago (genera comprobante contable)">
          {obligacionesVigentes.length === 0 || cuentasGasto.length === 0 || cuentasBanco.length === 0 ? (
            <p className="text-sm text-slate-400">
              Necesitas una obligación vigente y cuentas contables de gasto (5*) y banco (11*) sembradas en Contabilidad.
            </p>
          ) : (
            <form action={pagoAction} className="grid gap-2">
              <select name="obligacionId" required value={pagoForm.obligacionId} onChange={(e) => setPagoForm({ ...pagoForm, obligacionId: e.target.value })} className={INPUT}>
                <option value="" disabled>— Obligación —</option>
                {obligacionesVigentes.map((o) => (
                  <option key={o.id} value={o.id}>{o.etiqueta}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="fecha" type="date" required value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} className={INPUT} />
                <select name="medioPago" value={pagoForm.medioPago} onChange={(e) => setPagoForm({ ...pagoForm, medioPago: e.target.value })} className={INPUT}>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select name="cuentaGastoId" required value={pagoForm.cuentaGastoId} onChange={(e) => setPagoForm({ ...pagoForm, cuentaGastoId: e.target.value })} className={INPUT}>
                  <option value="" disabled>— Cuenta de gasto (débito) —</option>
                  {cuentasGasto.map((c) => (
                    <option key={c.id} value={c.id}>{c.etiqueta}</option>
                  ))}
                </select>
                <select name="cuentaBancoId" required value={pagoForm.cuentaBancoId} onChange={(e) => setPagoForm({ ...pagoForm, cuentaBancoId: e.target.value })} className={INPUT}>
                  <option value="" disabled>— Cuenta de banco (crédito) —</option>
                  {cuentasBanco.map((c) => (
                    <option key={c.id} value={c.id}>{c.etiqueta}</option>
                  ))}
                </select>
              </div>
              <input name="referencia" placeholder="Referencia (opcional)" value={pagoForm.referencia} onChange={(e) => setPagoForm({ ...pagoForm, referencia: e.target.value })} className={INPUT} />
              <input name="valor" type="number" min="0" step="0.01" placeholder="Valor" required value={pagoForm.valor} onChange={(e) => setPagoForm({ ...pagoForm, valor: e.target.value })} className={INPUT} />
              <button type="submit" disabled={pagoPend} className={BTN}>{pagoPend ? "Registrando…" : "Registrar pago"}</button>
            </form>
          )}
          <Mensaje state={pagoState} />
        </Tarjeta>
      )}
    </div>
  )
}

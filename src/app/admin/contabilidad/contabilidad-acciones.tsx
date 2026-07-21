"use client"

import { useActionState, useState } from "react"
import {
  sembrarPlanCuentasAction,
  crearPeriodoAction,
  crearTerceroAction,
  registrarComprobanteAction,
  type CpState,
} from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface CuentaOpcion extends Opcion {
  naturaleza: string
}

interface Props {
  puedeAdministrar: boolean
  puedeRegistrar: boolean
  planCuentasVacio: boolean
  cuentas: CuentaOpcion[]
  periodos: Opcion[]
  terceros: Opcion[]
}

interface Linea {
  cuentaId: string
  terceroId: string
  debito: string
  credito: string
  descripcion: string
}

const inicial: CpState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const BTN_SECUNDARIO = "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"

function lineaVacia(): Linea {
  return { cuentaId: "", terceroId: "", debito: "", credito: "", descripcion: "" }
}

function Mensaje({ state }: { state: CpState }) {
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

export function ContabilidadAcciones({ puedeAdministrar, puedeRegistrar, planCuentasVacio, cuentas, periodos, terceros }: Props) {
  const [semState, semAction, semPend] = useActionState(sembrarPlanCuentasAction, inicial)
  const [perState, perAction, perPend] = useActionState(crearPeriodoAction, inicial)
  const [terState, terAction, terPend] = useActionState(crearTerceroAction, inicial)
  const [compState, compAction, compPend] = useActionState(registrarComprobanteAction, inicial)

  const [tipo, setTipo] = useState("CONTABLE")
  const [fecha, setFecha] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [periodoId, setPeriodoId] = useState("")
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia(), lineaVacia()])

  const totalDebito = lineas.reduce((s, l) => s + (Number(l.debito) || 0), 0)
  const totalCredito = lineas.reduce((s, l) => s + (Number(l.credito) || 0), 0)
  const cuadra = totalDebito > 0 && Math.abs(totalDebito - totalCredito) < 0.005

  function actualizarLinea(i: number, campo: keyof Linea, valor: string) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)))
  }

  const asientosJson = JSON.stringify(
    lineas
      .filter((l) => l.cuentaId)
      .map((l) => ({
        cuentaId: l.cuentaId,
        terceroId: l.terceroId || null,
        debito: Number(l.debito) || 0,
        credito: Number(l.credito) || 0,
        descripcion: l.descripcion || null,
      })),
  )

  return (
    <div className="grid gap-4">
      {puedeAdministrar && planCuentasVacio && (
        <Tarjeta titulo="Plan de cuentas">
          <p className="mb-3 text-sm text-slate-500">
            Siembra el Catálogo General de Cuentas (CGC, Res. CGN 533/2015) para poder registrar comprobantes.
          </p>
          <form action={semAction}>
            <button type="submit" disabled={semPend} className={BTN}>
              {semPend ? "Sembrando…" : "Sembrar plan de cuentas CGC"}
            </button>
          </form>
          <Mensaje state={semState} />
        </Tarjeta>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {puedeAdministrar && (
          <Tarjeta titulo="Nuevo periodo contable">
            <form action={perAction} className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input name="anio" type="number" min="2000" max="2100" placeholder="Año" required className={INPUT} />
                <select name="mes" defaultValue="" className={INPUT}>
                  <option value="">Anual (sin mes)</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>Mes {String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={perPend} className={BTN}>{perPend ? "Creando…" : "Crear periodo"}</button>
            </form>
            <Mensaje state={perState} />
          </Tarjeta>
        )}

        {puedeAdministrar && (
          <Tarjeta titulo="Nuevo tercero">
            <form action={terAction} className="grid gap-2">
              <div className="grid grid-cols-3 gap-2">
                <select name="tipoDocumento" defaultValue="NIT" className={INPUT}>
                  <option value="NIT">NIT</option>
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="PA">PA</option>
                  <option value="OTRO">Otro</option>
                </select>
                <input name="documento" placeholder="Documento" required className={`${INPUT} col-span-2`} />
              </div>
              <input name="razonSocial" placeholder="Razón social / nombre" required className={INPUT} />
              <button type="submit" disabled={terPend} className={BTN}>{terPend ? "Creando…" : "Crear tercero"}</button>
            </form>
            <Mensaje state={terState} />
          </Tarjeta>
        )}
      </div>

      {puedeRegistrar && (
        <Tarjeta titulo="Registrar comprobante">
          {cuentas.length === 0 || periodos.length === 0 ? (
            <p className="text-sm text-slate-400">
              Necesitas al menos una cuenta que permita movimientos y un periodo no cerrado.
            </p>
          ) : (
            <form action={compAction} className="grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={INPUT}>
                  <option value="CONTABLE">Contable</option>
                  <option value="EGRESO">Egreso</option>
                  <option value="INGRESO">Ingreso</option>
                  <option value="AJUSTE">Ajuste</option>
                  <option value="APERTURA">Apertura</option>
                  <option value="CIERRE">Cierre</option>
                </select>
                <input name="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={INPUT} />
                <select name="periodoId" value={periodoId} onChange={(e) => setPeriodoId(e.target.value)} required className={INPUT}>
                  <option value="" disabled>— Periodo —</option>
                  {periodos.map((p) => (
                    <option key={p.id} value={p.id}>{p.etiqueta}</option>
                  ))}
                </select>
              </div>
              <input
                name="descripcion"
                placeholder="Descripción del comprobante"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
                className={INPUT}
              />

              <div className="rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Cuenta</th>
                      <th className="px-2 py-2">Tercero</th>
                      <th className="px-2 py-2 text-right">Débito</th>
                      <th className="px-2 py-2 text-right">Crédito</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineas.map((l, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">
                          <select value={l.cuentaId} onChange={(e) => actualizarLinea(i, "cuentaId", e.target.value)} className={INPUT}>
                            <option value="">— Cuenta —</option>
                            {cuentas.map((c) => (
                              <option key={c.id} value={c.id}>{c.etiqueta}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={l.terceroId} onChange={(e) => actualizarLinea(i, "terceroId", e.target.value)} className={INPUT}>
                            <option value="">—</option>
                            {terceros.map((t) => (
                              <option key={t.id} value={t.id}>{t.etiqueta}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.01" placeholder="0"
                            value={l.debito}
                            onChange={(e) => actualizarLinea(i, "debito", e.target.value)}
                            className={`${INPUT} text-right`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.01" placeholder="0"
                            value={l.credito}
                            onChange={(e) => actualizarLinea(i, "credito", e.target.value)}
                            className={`${INPUT} text-right`}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {lineas.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-slate-400 hover:text-red-600"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-slate-100 px-2 py-2">
                  <button type="button" onClick={() => setLineas((prev) => [...prev, lineaVacia()])} className={BTN_SECUNDARIO}>
                    + Línea
                  </button>
                  <div className={`font-mono text-xs ${cuadra ? "text-emerald-700" : "text-red-600"}`}>
                    D ${totalDebito.toLocaleString()} · C ${totalCredito.toLocaleString()} {cuadra ? "✓ cuadra" : "≠ no cuadra"}
                  </div>
                </div>
              </div>

              <input type="hidden" name="asientos" value={asientosJson} />
              <button type="submit" disabled={compPend || !cuadra} className={BTN}>
                {compPend ? "Registrando…" : "Registrar comprobante"}
              </button>
            </form>
          )}
          <Mensaje state={compState} />
        </Tarjeta>
      )}
    </div>
  )
}

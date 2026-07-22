"use client"

import { useActionState, useEffect, useState } from "react"
import {
  crearContratoAction, enviarRevisionAction, asignarAbogadoAction, responderRevisionAction, registrarRpAction, avanzarSimpleAction,
  type ConState,
} from "./actions"

// Formateador propio (no Intl/toLocaleString): en un componente cliente, ese valor se renderiza
// tanto en el servidor (SSR) como al hidratar en el navegador, y si el runtime de Node no trae
// el locale "es-CO" en su ICU (común en serverless con ICU reducido), cada lado formatea distinto
// y React tira el error de hidratación #418. Un separador de miles manual es idéntico siempre.
function formatMoneda(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

interface Opcion { id: string; etiqueta: string }
interface Version {
  id: string; numeroVersion: number; tipo: string; aprobado: boolean | null
  contenido: string | null; observaciones: string | null; createdAt: string
}
interface ContratoDTO {
  id: string; numero: string; objeto: string; modalidad: string; estado: string; valorContrato: number
  tercero: string; estructuradorId: string | null; estructuradorNombre: string | null
  abogadoAsignadoId: string | null; abogadoNombre: string | null
  rpNumero: string | null; proyectoCodigo: string | null; versiones: Version[]
}

interface Props {
  usuarioId: string
  esAdmin: boolean
  puedeElaborar: boolean
  puedeRevisarJuridica: boolean
  puedeConceptoJuridico: boolean
  puedeAprobar: boolean
  puedeSupervisar: boolean
  terceros: Opcion[]
  rpsDisponibles: Opcion[]
  estructuradores: Opcion[]
  abogados: Opcion[]
  contratos: ContratoDTO[]
}

const inicial: ConState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const BTN_SEC = "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
const ANIO_ACTUAL = new Date().getFullYear()

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: "bg-slate-100 text-slate-700",
  EN_REVISION_JURIDICA: "bg-amber-100 text-amber-800",
  DEVUELTO_ESTRUCTURACION: "bg-red-100 text-red-700",
  PERFECCIONADO: "bg-blue-100 text-blue-700",
  RP_REGISTRADO: "bg-cyan-100 text-cyan-800",
  SUSCRITO: "bg-indigo-100 text-indigo-700",
  EN_EJECUCION: "bg-emerald-100 text-emerald-800",
  SUSPENDIDO: "bg-amber-100 text-amber-800",
  TERMINADO: "bg-slate-200 text-slate-600",
  INCUMPLIDO: "bg-red-200 text-red-800",
  LIQUIDADO: "bg-slate-200 text-slate-600",
}

function Mensaje({ state }: { state: ConState }) {
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

function useResetTrasExito(state: ConState, reset: () => void) {
  useEffect(() => {
    if (state.ok) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
}

export function ContratacionAcciones(props: Props) {
  const { esAdmin, puedeElaborar, terceros, estructuradores, contratos } = props
  const [proyState, proyAction, proyPend] = useActionState(crearContratoAction, inicial)
  const [form, setForm] = useState({ objeto: "", modalidad: "CONTRATACION_DIRECTA", valorContrato: "", terceroId: "", estructuradorId: "", vigencia: String(ANIO_ACTUAL), plazoDias: "" })
  useResetTrasExito(proyState, () => setForm({ objeto: "", modalidad: "CONTRATACION_DIRECTA", valorContrato: "", terceroId: "", estructuradorId: "", vigencia: String(ANIO_ACTUAL), plazoDias: "" }))

  return (
    <div className="grid gap-4">
      {(esAdmin || puedeElaborar) && (
        <Tarjeta titulo="Nuevo contrato">
          {terceros.length === 0 || estructuradores.length === 0 ? (
            <p className="text-sm text-slate-400">
              Necesitas al menos un tercero (Contabilidad → Terceros) y un usuario con capacidad `elaborar` asignado por cargo.
            </p>
          ) : (
            <form action={proyAction} className="grid gap-2">
              <input name="objeto" placeholder="Objeto del contrato" required value={form.objeto} onChange={(e) => setForm({ ...form, objeto: e.target.value })} className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <select name="modalidad" value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })} className={INPUT}>
                  <option value="CONTRATACION_DIRECTA">Contratación directa</option>
                  <option value="MINIMA_CUANTIA">Mínima cuantía</option>
                  <option value="SELECCION_ABREVIADA">Selección abreviada</option>
                  <option value="LICITACION_PUBLICA">Licitación pública</option>
                  <option value="CONCURSO_MERITOS">Concurso de méritos</option>
                </select>
                <input name="valorContrato" type="number" min="0" step="0.01" placeholder="Valor" required value={form.valorContrato} onChange={(e) => setForm({ ...form, valorContrato: e.target.value })} className={INPUT} />
              </div>
              <select name="terceroId" required value={form.terceroId} onChange={(e) => setForm({ ...form, terceroId: e.target.value })} className={INPUT}>
                <option value="" disabled>— Contratista —</option>
                {terceros.map((t) => (<option key={t.id} value={t.id}>{t.etiqueta}</option>))}
              </select>
              <select name="estructuradorId" required value={form.estructuradorId} onChange={(e) => setForm({ ...form, estructuradorId: e.target.value })} className={INPUT}>
                <option value="" disabled>— Estructurador asignado —</option>
                {estructuradores.map((u) => (<option key={u.id} value={u.id}>{u.etiqueta}</option>))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="vigencia" type="number" min="2000" max="2100" required value={form.vigencia} onChange={(e) => setForm({ ...form, vigencia: e.target.value })} className={INPUT} />
                <input name="plazoDias" type="number" min="1" placeholder="Plazo (días, opcional)" value={form.plazoDias} onChange={(e) => setForm({ ...form, plazoDias: e.target.value })} className={INPUT} />
              </div>
              <p className="text-xs text-slate-400">
                El RP (y el proyecto que financia, si aplica) se registran más adelante en el flujo — antes de suscribir, no al crear el borrador.
              </p>
              <button type="submit" disabled={proyPend} className={BTN}>{proyPend ? "Creando…" : "Crear contrato (BORRADOR)"}</button>
            </form>
          )}
          <Mensaje state={proyState} />
        </Tarjeta>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Contratos</h2>
        {contratos.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay contratos.</p>
        ) : (
          <div className="space-y-3">
            {contratos.map((c) => (
              <FilaContrato key={c.id} contrato={c} {...props} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FilaContrato({ contrato: c, usuarioId, esAdmin, puedeElaborar, puedeRevisarJuridica, puedeConceptoJuridico, puedeAprobar, puedeSupervisar, abogados, rpsDisponibles }: Props & { contrato: ContratoDTO }) {
  const [enviarState, enviarAction, enviarPend] = useActionState(enviarRevisionAction, inicial)
  const [asignarState, asignarAction, asignarPend] = useActionState(asignarAbogadoAction, inicial)
  const [responderState, responderAction, responderPend] = useActionState(responderRevisionAction, inicial)
  const [registrarRpState, registrarRpActionForm, registrarRpPend] = useActionState(registrarRpAction, inicial)
  const [avanzarState, avanzarAction, avanzarPend] = useActionState(avanzarSimpleAction, inicial)

  const [contenido, setContenido] = useState("")
  const [observaciones, setObservaciones] = useState("")
  const [abogadoElegido, setAbogadoElegido] = useState("")
  const [rpElegido, setRpElegido] = useState("")

  useResetTrasExito(enviarState, () => setContenido(""))
  useResetTrasExito(responderState, () => setObservaciones(""))
  useResetTrasExito(asignarState, () => setAbogadoElegido(""))
  useResetTrasExito(registrarRpState, () => setRpElegido(""))

  const esMiEstructurado = c.estructuradorId === usuarioId
  const esMiRevision = c.abogadoAsignadoId === usuarioId

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono text-xs text-slate-500">{c.numero}</span>
          <span className="ml-2 font-medium text-slate-800">{c.objeto}</span>
          <span className="ml-2 text-xs text-slate-400">{c.tercero} · ${formatMoneda(c.valorContrato)}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[c.estado] ?? "bg-slate-100 text-slate-700"}`}>{c.estado}</span>
      </summary>

      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        <div className="text-xs text-slate-500">
          Estructurador: <span className="text-slate-700">{c.estructuradorNombre ?? "—"}</span> · Abogado:{" "}
          <span className="text-slate-700">{c.abogadoNombre ?? "sin asignar"}</span>
          {c.rpNumero && (
            <>
              {" "}· RP: <span className="text-slate-700">{c.rpNumero}</span>
              {c.proyectoCodigo && <> · Proyecto: <span className="text-slate-700">{c.proyectoCodigo}</span></>}
            </>
          )}
        </div>

        {(c.estado === "BORRADOR" || c.estado === "DEVUELTO_ESTRUCTURACION") && (esAdmin || (puedeElaborar && esMiEstructurado)) && (
          <form action={enviarAction} className="grid gap-2">
            <input type="hidden" name="contratoId" value={c.id} />
            <textarea name="contenido" placeholder="Contenido del contrato (mínimo 10 caracteres)" required minLength={10} value={contenido} onChange={(e) => setContenido(e.target.value)} rows={3} className={INPUT} />
            <button type="submit" disabled={enviarPend} className={BTN}>{enviarPend ? "Enviando…" : "Enviar a revisión jurídica"}</button>
            <Mensaje state={enviarState} />
          </form>
        )}

        {c.estado === "EN_REVISION_JURIDICA" && !c.abogadoAsignadoId && (esAdmin || puedeConceptoJuridico) && (
          <form action={asignarAction} className="grid gap-2">
            <input type="hidden" name="contratoId" value={c.id} />
            <select name="abogadoAsignadoId" required value={abogadoElegido} onChange={(e) => setAbogadoElegido(e.target.value)} className={INPUT}>
              <option value="" disabled>— Asignar abogado revisor —</option>
              {abogados.map((a) => (<option key={a.id} value={a.id}>{a.etiqueta}</option>))}
            </select>
            <button type="submit" disabled={asignarPend} className={BTN_SEC}>{asignarPend ? "Asignando…" : "Asignar abogado"}</button>
            <Mensaje state={asignarState} />
          </form>
        )}

        {c.estado === "EN_REVISION_JURIDICA" && c.abogadoAsignadoId && (esAdmin || (puedeRevisarJuridica && esMiRevision)) && (
          <form action={responderAction} className="grid gap-2">
            <input type="hidden" name="contratoId" value={c.id} />
            <textarea name="observaciones" placeholder="Observaciones (mínimo 5 caracteres)" required minLength={5} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={INPUT} />
            <div className="flex gap-2">
              <button type="submit" name="decision" value="aprobar" disabled={responderPend} className={BTN}>Perfeccionar (aprobar)</button>
              <button type="submit" name="decision" value="devolver" disabled={responderPend} className={BTN_SEC}>Devolver a estructuración</button>
            </div>
            <Mensaje state={responderState} />
          </form>
        )}

        {c.estado === "PERFECCIONADO" && (esAdmin || puedeAprobar) && (
          rpsDisponibles.length === 0 ? (
            <p className="text-xs text-slate-400">
              No hay RP vigentes libres para respaldar este contrato. Expedí uno en Presupuesto (con saldo ≥ ${formatMoneda(c.valorContrato)}) antes de continuar.
            </p>
          ) : (
            <form action={registrarRpActionForm} className="grid gap-2">
              <input type="hidden" name="contratoId" value={c.id} />
              <select name="rpId" required value={rpElegido} onChange={(e) => setRpElegido(e.target.value)} className={INPUT}>
                <option value="" disabled>— Registrar RP (obligatorio antes de suscribir) —</option>
                {rpsDisponibles.map((r) => (<option key={r.id} value={r.id}>{r.etiqueta}</option>))}
              </select>
              <button type="submit" disabled={registrarRpPend} className={BTN}>{registrarRpPend ? "Registrando…" : "Registrar RP"}</button>
              <Mensaje state={registrarRpState} />
            </form>
          )
        )}

        {c.estado === "RP_REGISTRADO" && (esAdmin || puedeAprobar) && (
          <form action={avanzarAction}>
            <input type="hidden" name="contratoId" value={c.id} />
            <input type="hidden" name="accion" value="suscribir" />
            <button type="submit" disabled={avanzarPend} className={BTN}>{avanzarPend ? "Suscribiendo…" : "Suscribir contrato"}</button>
          </form>
        )}

        {c.estado === "SUSCRITO" && (esAdmin || puedeAprobar || puedeSupervisar) && (
          <form action={avanzarAction}>
            <input type="hidden" name="contratoId" value={c.id} />
            <input type="hidden" name="accion" value="iniciar_ejecucion" />
            <button type="submit" disabled={avanzarPend} className={BTN}>{avanzarPend ? "Iniciando…" : "Iniciar ejecución"}</button>
          </form>
        )}

        {c.estado === "EN_EJECUCION" && (esAdmin || puedeAprobar || puedeSupervisar) && (
          <form action={avanzarAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="contratoId" value={c.id} />
            <button type="submit" name="accion" value="suspender" disabled={avanzarPend} className={BTN_SEC}>Suspender</button>
            <button type="submit" name="accion" value="terminar" disabled={avanzarPend} className={BTN_SEC}>Terminar</button>
            <button type="submit" name="accion" value="incumplir" disabled={avanzarPend} className={BTN_SEC}>Incumplir</button>
            <button type="submit" name="accion" value="liquidar" disabled={avanzarPend} className={BTN}>Liquidar</button>
          </form>
        )}

        {c.estado === "SUSPENDIDO" && (esAdmin || puedeAprobar || puedeSupervisar) && (
          <form action={avanzarAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="contratoId" value={c.id} />
            <button type="submit" name="accion" value="reanudar" disabled={avanzarPend} className={BTN}>Reanudar ejecución</button>
            <button type="submit" name="accion" value="terminar" disabled={avanzarPend} className={BTN_SEC}>Terminar</button>
          </form>
        )}
        <Mensaje state={avanzarState} />

        {c.versiones.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Historial de versiones</div>
            <ul className="space-y-1">
              {c.versiones.map((v) => (
                <li key={v.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  v{v.numeroVersion} · {v.tipo} {v.aprobado !== null ? (v.aprobado ? "· aprobado" : "· devuelto") : ""} · {v.createdAt.slice(0, 16).replace("T", " ")}
                  {v.observaciones && <div className="mt-1 text-slate-500">{v.observaciones}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}

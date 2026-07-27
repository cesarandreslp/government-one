"use client"

import { useActionState } from "react"
import { registrarFichaAction, actualizarVigenciaAction, type SisbenState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  personas: Opcion[]
  registros: Opcion[]
}

const inicial: SisbenState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: SisbenState }) {
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

export function SisbenAcciones({ puedeAdministrar, personas, registros }: Props) {
  const [regState, regAction, regPend] = useActionState(registrarFichaAction, inicial)
  const [vigState, vigAction, vigPend] = useActionState(actualizarVigenciaAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tarjeta titulo="Registrar ficha SISBEN">
        {personas.length === 0 ? (
          <p className="text-sm text-slate-400">No hay terceros registrados (se crean desde Contabilidad).</p>
        ) : (
          <form action={regAction} className="grid gap-2">
            <select name="personaId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Persona —</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </select>
            <input name="ficha" required placeholder="Número de ficha" className={INPUT} />
            <div className="grid grid-cols-2 gap-2">
              <select name="grupo" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Grupo —</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
              <input name="puntaje" type="number" min="0" step="0.01" placeholder="Puntaje (opcional)" className={INPUT} />
            </div>
            <input name="fechaEncuesta" type="date" required className={INPUT} />
            <textarea name="observaciones" rows={2} placeholder="Observaciones (opcional)" className={INPUT} />
            <button type="submit" disabled={regPend} className={BTN}>{regPend ? "Registrando…" : "Registrar ficha"}</button>
          </form>
        )}
        <Mensaje state={regState} />
      </Tarjeta>

      <Tarjeta titulo="Actualizar vigencia">
        {registros.length === 0 ? (
          <p className="text-sm text-slate-400">No hay fichas registradas.</p>
        ) : (
          <form action={vigAction} className="grid gap-2">
            <select name="registroId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Ficha —</option>
              {registros.map((r) => <option key={r.id} value={r.id}>{r.etiqueta}</option>)}
            </select>
            <select name="vigente" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Nueva vigencia —</option>
              <option value="true">Vigente</option>
              <option value="false">No vigente</option>
            </select>
            <button type="submit" disabled={vigPend} className={BTN}>{vigPend ? "Actualizando…" : "Actualizar vigencia"}</button>
          </form>
        )}
        <Mensaje state={vigState} />
      </Tarjeta>
    </div>
  )
}

"use client"

import { useActionState } from "react"
import { registrarRiesgoAction, registrarIncidenteAction, registrarExamenAction, type SstState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  cargos: Opcion[]
  usuarios: Opcion[]
}

const inicial: SstState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: SstState }) {
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

export function SstAcciones({ puedeAdministrar, cargos, usuarios }: Props) {
  const [riesgoState, riesgoAction, riesgoPend] = useActionState(registrarRiesgoAction, inicial)
  const [incState, incAction, incPend] = useActionState(registrarIncidenteAction, inicial)
  const [examState, examAction, examPend] = useActionState(registrarExamenAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tarjeta titulo="Registrar riesgo (matriz de riesgos)">
        {cargos.length === 0 ? (
          <p className="text-sm text-slate-400">No hay cargos registrados.</p>
        ) : (
          <form action={riesgoAction} className="grid gap-2">
            <select name="cargoId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Cargo —</option>
              {cargos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
            </select>
            <input name="peligro" placeholder="Peligro (ej. locativo, biomecánico)" required className={INPUT} />
            <input name="riesgo" placeholder="Riesgo asociado (ej. caída, trastorno osteomuscular)" required className={INPUT} />
            <select name="nivelRiesgo" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Nivel —</option>
              <option value="ACEPTABLE">Aceptable</option>
              <option value="MEJORABLE">Mejorable</option>
              <option value="NO_ACEPTABLE">No aceptable</option>
            </select>
            <textarea name="medidasControl" rows={2} placeholder="Medidas de control (opcional)" className={INPUT} />
            <button type="submit" disabled={riesgoPend} className={BTN}>{riesgoPend ? "Guardando…" : "Registrar riesgo"}</button>
          </form>
        )}
        <Mensaje state={riesgoState} />
      </Tarjeta>

      <Tarjeta titulo="Registrar accidente / incidente">
        {usuarios.length === 0 ? (
          <p className="text-sm text-slate-400">No hay funcionarios registrados.</p>
        ) : (
          <form action={incAction} className="grid gap-2">
            <select name="usuarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Funcionario —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select name="tipo" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Tipo —</option>
                <option value="ACCIDENTE">Accidente</option>
                <option value="INCIDENTE">Incidente</option>
                <option value="ENFERMEDAD_LABORAL">Enfermedad laboral</option>
              </select>
              <input name="fecha" type="date" required className={INPUT} />
            </div>
            <textarea name="descripcion" required rows={2} placeholder="Descripción de lo ocurrido" className={INPUT} />
            <input name="diasIncapacidad" type="number" min="0" placeholder="Días de incapacidad (opcional)" className={INPUT} />
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input name="reportadoArl" type="checkbox" /> Ya se reportó a la ARL
            </label>
            <button type="submit" disabled={incPend} className={BTN}>{incPend ? "Guardando…" : "Registrar"}</button>
          </form>
        )}
        <Mensaje state={incState} />
      </Tarjeta>

      <Tarjeta titulo="Registrar examen médico ocupacional">
        {usuarios.length === 0 ? (
          <p className="text-sm text-slate-400">No hay funcionarios registrados.</p>
        ) : (
          <form action={examAction} className="grid gap-2">
            <select name="usuarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Funcionario —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select name="tipo" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Tipo —</option>
                <option value="INGRESO">Ingreso</option>
                <option value="PERIODICO">Periódico</option>
                <option value="RETIRO">Retiro</option>
              </select>
              <input name="fecha" type="date" required className={INPUT} />
            </div>
            <select name="resultado" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Resultado —</option>
              <option value="APTO">Apto</option>
              <option value="APTO_CON_RESTRICCIONES">Apto con restricciones</option>
              <option value="NO_APTO">No apto</option>
            </select>
            <textarea name="observaciones" rows={2} placeholder="Observaciones (opcional)" className={INPUT} />
            <button type="submit" disabled={examPend} className={BTN}>{examPend ? "Guardando…" : "Registrar examen"}</button>
          </form>
        )}
        <Mensaje state={examState} />
      </Tarjeta>
    </div>
  )
}

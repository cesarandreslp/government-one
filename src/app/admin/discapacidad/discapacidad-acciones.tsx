"use client"

import { useActionState } from "react"
import { crearPersonaAction, registrarDiscapacidadAction, actualizarVigenciaAction, type DiscapState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  personas: Opcion[]
  registros: Opcion[]
}

const inicial: DiscapState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const TIPOS = ["FISICA", "VISUAL", "AUDITIVA", "INTELECTUAL", "PSICOSOCIAL", "MULTIPLE", "OTRA"]

function Mensaje({ state }: { state: DiscapState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function DiscapacidadAcciones({ puedeAdministrar, personas, registros }: Props) {
  const [stPersona, actPersona, pendPersona] = useActionState(crearPersonaAction, inicial)
  const [stReg, actReg, pendReg] = useActionState(registrarDiscapacidadAction, inicial)
  const [stVig, actVig, pendVig] = useActionState(actualizarVigenciaAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Nueva persona</h3>
        <form action={actPersona} className="grid gap-2 md:grid-cols-2">
          <select name="tipoDocumento" defaultValue="CC" className={INPUT}>
            <option value="CC">CC</option>
            <option value="CE">CE</option>
            <option value="NIT">NIT</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
          <input name="documento" required placeholder="Documento" className={INPUT} />
          <input name="razonSocial" required placeholder="Nombre completo" className={`${INPUT} md:col-span-2`} />
          <button type="submit" disabled={pendPersona} className={`${BTN} md:col-span-2`}>{pendPersona ? "Creando…" : "Crear persona"}</button>
        </form>
        <Mensaje state={stPersona} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Registrar discapacidad</h3>
        {personas.length === 0 ? (
          <p className="text-sm text-slate-400">Crea primero una persona.</p>
        ) : (
          <form action={actReg} className="grid gap-2">
            <select name="personaId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Persona —</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </select>
            <select name="tipo" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Tipo de discapacidad —</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input name="fechaRegistro" type="date" required className={INPUT} />
            <input name="origen" placeholder="Origen (congénita, adquirida… opcional)" className={INPUT} />
            <textarea name="observaciones" rows={2} placeholder="Observaciones (opcional)" className={INPUT} />
            <button type="submit" disabled={pendReg} className={BTN}>{pendReg ? "Registrando…" : "Registrar"}</button>
          </form>
        )}
        <Mensaje state={stReg} />

        {registros.length > 0 && (
          <form action={actVig} className="mt-4 grid gap-2 border-t border-slate-100 pt-3">
            <select name="registroId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Registro —</option>
              {registros.map((r) => <option key={r.id} value={r.id}>{r.etiqueta}</option>)}
            </select>
            <select name="vigente" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Nueva vigencia —</option>
              <option value="true">VIGENTE</option>
              <option value="false">NO VIGENTE</option>
            </select>
            <button type="submit" disabled={pendVig} className={BTN}>{pendVig ? "…" : "Actualizar vigencia"}</button>
          </form>
        )}
        <Mensaje state={stVig} />
      </div>
    </div>
  )
}

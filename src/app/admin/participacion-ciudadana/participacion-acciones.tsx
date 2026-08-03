"use client"

import { useActionState } from "react"
import { crearPersonaAction, crearJacAction, crearDignatarioAction, actualizarEstadoJacAction, type PartState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  jacs: Opcion[]
  personas: Opcion[]
}

const inicial: PartState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const CARGOS = ["PRESIDENTE", "VICEPRESIDENTE", "SECRETARIO", "TESORERO", "FISCAL", "VOCAL"]

function Mensaje({ state }: { state: PartState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function ParticipacionAcciones({ puedeAdministrar, jacs, personas }: Props) {
  const [stJac, actJac, pendJac] = useActionState(crearJacAction, inicial)
  const [stPersona, actPersona, pendPersona] = useActionState(crearPersonaAction, inicial)
  const [stDig, actDig, pendDig] = useActionState(crearDignatarioAction, inicial)
  const [stEstado, actEstado, pendEstado] = useActionState(actualizarEstadoJacAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Nueva JAC</h3>
        <form action={actJac} className="grid gap-2">
          <input name="nombre" required placeholder="Nombre de la JAC" className={INPUT} />
          <input name="barrioVereda" required placeholder="Barrio / vereda" className={INPUT} />
          <input name="personeriaJuridica" placeholder="Personería jurídica (opcional)" className={INPUT} />
          <input name="fechaPersoneria" type="date" className={INPUT} />
          <button type="submit" disabled={pendJac} className={BTN}>{pendJac ? "Creando…" : "Crear JAC"}</button>
        </form>
        <Mensaje state={stJac} />

        {jacs.length > 0 && (
          <form action={actEstado} className="mt-4 grid gap-2 border-t border-slate-100 pt-3">
            <select name="jacId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— JAC —</option>
              {jacs.map((j) => <option key={j.id} value={j.id}>{j.etiqueta}</option>)}
            </select>
            <select name="estado" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Nuevo estado —</option>
              <option value="ACTIVA">ACTIVA</option>
              <option value="INACTIVA">INACTIVA</option>
            </select>
            <button type="submit" disabled={pendEstado} className={BTN}>{pendEstado ? "…" : "Cambiar estado"}</button>
          </form>
        )}
        <Mensaje state={stEstado} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Nueva persona (dignatario)</h3>
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

        {jacs.length > 0 && personas.length > 0 && (
          <form action={actDig} className="mt-4 grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-2">
            <select name="jacId" required defaultValue="" className={`${INPUT} md:col-span-2`}>
              <option value="" disabled>— JAC —</option>
              {jacs.map((j) => <option key={j.id} value={j.id}>{j.etiqueta}</option>)}
            </select>
            <select name="personaId" required defaultValue="" className={`${INPUT} md:col-span-2`}>
              <option value="" disabled>— Persona —</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </select>
            <select name="cargo" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Cargo —</option>
              {CARGOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input name="actoEleccion" placeholder="Acta de elección (opcional)" className={INPUT} />
            <label className="text-xs text-slate-500">Inicio período<input name="periodoInicio" type="date" required className={INPUT} /></label>
            <label className="text-xs text-slate-500">Fin período<input name="periodoFin" type="date" required className={INPUT} /></label>
            <button type="submit" disabled={pendDig} className={`${BTN} md:col-span-2`}>{pendDig ? "Registrando…" : "Registrar dignatario"}</button>
          </form>
        )}
        <Mensaje state={stDig} />
      </div>
    </div>
  )
}

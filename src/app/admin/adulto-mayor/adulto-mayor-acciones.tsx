"use client"

import { useActionState } from "react"
import { crearPersonaAction, registrarBeneficiarioAction, actualizarEstadoAction, type AmState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  personas: Opcion[]
  beneficiarios: Opcion[]
}

const inicial: AmState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const PROGRAMAS = ["COLOMBIA_MAYOR", "CENTRO_DIA", "CENTRO_BIENESTAR_ANCIANO", "OTRO"]
const ESTADOS = ["POSTULADO", "ACTIVO", "RETIRADO"]

function Mensaje({ state }: { state: AmState }) {
  if (state.error) return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
  if (state.ok) return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✅ {state.mensaje}</p>
  return null
}

export function AdultoMayorAcciones({ puedeAdministrar, personas, beneficiarios }: Props) {
  const [stPersona, actPersona, pendPersona] = useActionState(crearPersonaAction, inicial)
  const [stBen, actBen, pendBen] = useActionState(registrarBeneficiarioAction, inicial)
  const [stEstado, actEstado, pendEstado] = useActionState(actualizarEstadoAction, inicial)

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
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Registrar beneficiario</h3>
        {personas.length === 0 ? (
          <p className="text-sm text-slate-400">Crea primero una persona.</p>
        ) : (
          <form action={actBen} className="grid gap-2">
            <select name="personaId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Persona —</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </select>
            <select name="programa" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Programa —</option>
              {PROGRAMAS.map((p) => <option key={p} value={p}>{p.replaceAll("_", " ")}</option>)}
            </select>
            <input name="fechaIngreso" type="date" required className={INPUT} />
            <textarea name="observaciones" rows={2} placeholder="Observaciones (opcional)" className={INPUT} />
            <button type="submit" disabled={pendBen} className={BTN}>{pendBen ? "Registrando…" : "Registrar beneficiario"}</button>
          </form>
        )}
        <Mensaje state={stBen} />

        {beneficiarios.length > 0 && (
          <form action={actEstado} className="mt-4 grid gap-2 border-t border-slate-100 pt-3">
            <select name="beneficiarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Beneficiario —</option>
              {beneficiarios.map((b) => <option key={b.id} value={b.id}>{b.etiqueta}</option>)}
            </select>
            <select name="estado" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Nuevo estado —</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <button type="submit" disabled={pendEstado} className={BTN}>{pendEstado ? "…" : "Actualizar estado"}</button>
          </form>
        )}
        <Mensaje state={stEstado} />
      </div>
    </div>
  )
}

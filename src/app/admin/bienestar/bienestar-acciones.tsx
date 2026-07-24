"use client"

import { useActionState } from "react"
import { crearActividadAction, inscribirParticipanteAction, type BienestarState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  usuarios: Opcion[]
  actividades: Opcion[]
}

const inicial: BienestarState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: BienestarState }) {
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

export function BienestarAcciones({ puedeAdministrar, usuarios, actividades }: Props) {
  const [crearState, crearAction, crearPend] = useActionState(crearActividadAction, inicial)
  const [partState, partAction, partPend] = useActionState(inscribirParticipanteAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tarjeta titulo="Nueva actividad de bienestar">
        <form action={crearAction} className="grid gap-2">
          <input name="nombre" placeholder="Nombre de la actividad" required className={INPUT} />
          <select name="tipo" required defaultValue="" className={INPUT}>
            <option value="" disabled>— Tipo —</option>
            <option value="DEPORTIVA">Deportiva</option>
            <option value="CULTURAL">Cultural</option>
            <option value="INTEGRACION">Integración</option>
            <option value="RECONOCIMIENTO">Reconocimiento</option>
          </select>
          <input name="fecha" type="date" required className={INPUT} />
          <textarea name="descripcion" rows={2} placeholder="Descripción (opcional)" className={INPUT} />
          <button type="submit" disabled={crearPend} className={BTN}>{crearPend ? "Guardando…" : "Registrar"}</button>
        </form>
        <Mensaje state={crearState} />
      </Tarjeta>

      <Tarjeta titulo="Agregar participante">
        {actividades.length === 0 || usuarios.length === 0 ? (
          <p className="text-sm text-slate-400">Registra una actividad primero.</p>
        ) : (
          <form action={partAction} className="grid gap-2">
            <select name="actividadId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Actividad —</option>
              {actividades.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
            </select>
            <select name="usuarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Funcionario —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
            </select>
            <button type="submit" disabled={partPend} className={BTN}>{partPend ? "Agregando…" : "Agregar participante"}</button>
          </form>
        )}
        <Mensaje state={partState} />
      </Tarjeta>
    </div>
  )
}

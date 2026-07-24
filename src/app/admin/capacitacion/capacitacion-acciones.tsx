"use client"

import { useActionState } from "react"
import { crearCapacitacionAction, inscribirAction, marcarAsistenciaAction, type CapacitacionState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  usuarios: Opcion[]
  capacitaciones: Opcion[]
  inscripcionesPendientes: Opcion[]
}

const inicial: CapacitacionState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: CapacitacionState }) {
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

export function CapacitacionAcciones({ puedeAdministrar, usuarios, capacitaciones, inscripcionesPendientes }: Props) {
  const [crearState, crearAction, crearPend] = useActionState(crearCapacitacionAction, inicial)
  const [inscState, inscAction, inscPend] = useActionState(inscribirAction, inicial)
  const [asisState, asisAction, asisPend] = useActionState(marcarAsistenciaAction, inicial)

  if (!puedeAdministrar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tarjeta titulo="Nueva capacitación">
        <form action={crearAction} className="grid gap-2">
          <input name="nombre" placeholder="Nombre" required className={INPUT} />
          <select name="tipo" required defaultValue="" className={INPUT}>
            <option value="" disabled>— Tipo —</option>
            <option value="CURSO">Curso</option>
            <option value="DIPLOMADO">Diplomado</option>
            <option value="INDUCCION">Inducción</option>
            <option value="REINDUCCION">Reinducción</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="fechaInicio" type="date" required className={INPUT} />
            <input name="fechaFin" type="date" required className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="horas" type="number" min="0" placeholder="Horas (opcional)" className={INPUT} />
            <input name="entidadCapacitadora" placeholder="Entidad capacitadora (opcional)" className={INPUT} />
          </div>
          <button type="submit" disabled={crearPend} className={BTN}>{crearPend ? "Guardando…" : "Registrar"}</button>
        </form>
        <Mensaje state={crearState} />
      </Tarjeta>

      <Tarjeta titulo="Inscribir funcionario">
        {capacitaciones.length === 0 || usuarios.length === 0 ? (
          <p className="text-sm text-slate-400">Registra una capacitación primero.</p>
        ) : (
          <form action={inscAction} className="grid gap-2">
            <select name="capacitacionId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Capacitación —</option>
              {capacitaciones.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
            </select>
            <select name="usuarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Funcionario —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
            </select>
            <button type="submit" disabled={inscPend} className={BTN}>{inscPend ? "Inscribiendo…" : "Inscribir"}</button>
          </form>
        )}
        <Mensaje state={inscState} />
      </Tarjeta>

      <Tarjeta titulo="Marcar asistencia">
        {inscripcionesPendientes.length === 0 ? (
          <p className="text-sm text-slate-400">No hay inscripciones pendientes de asistencia.</p>
        ) : (
          <form action={asisAction} className="grid gap-2">
            <select name="inscripcionId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Inscripción —</option>
              {inscripcionesPendientes.map((i) => <option key={i.id} value={i.id}>{i.etiqueta}</option>)}
            </select>
            <button type="submit" disabled={asisPend} className={BTN}>{asisPend ? "Guardando…" : "Marcar asistió"}</button>
          </form>
        )}
        <Mensaje state={asisState} />
      </Tarjeta>
    </div>
  )
}

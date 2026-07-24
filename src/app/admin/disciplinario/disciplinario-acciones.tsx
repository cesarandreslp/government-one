"use client"

import { useActionState } from "react"
import { abrirProcesoAction, registrarActuacionAction, type DiscState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeGestionar: boolean
  usuarios: Opcion[]
  procesosAbiertos: Opcion[]
}

const inicial: DiscState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: DiscState }) {
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

export function DisciplinarioAcciones({ puedeGestionar, usuarios, procesosAbiertos }: Props) {
  const [abrirState, abrirAction, abrirPend] = useActionState(abrirProcesoAction, inicial)
  const [actState, actAction, actPend] = useActionState(registrarActuacionAction, inicial)

  if (!puedeGestionar) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tarjeta titulo="Abrir proceso disciplinario">
        {usuarios.length === 0 ? (
          <p className="text-sm text-slate-400">No hay funcionarios registrados.</p>
        ) : (
          <form action={abrirAction} className="grid gap-2">
            <select name="usuarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Funcionario —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
            </select>
            <textarea name="motivo" required rows={2} placeholder="Motivo / queja" className={INPUT} />
            <input name="fecha" type="date" required className={INPUT} />
            <button type="submit" disabled={abrirPend} className={BTN}>{abrirPend ? "Abriendo…" : "Abrir proceso"}</button>
          </form>
        )}
        <Mensaje state={abrirState} />
      </Tarjeta>

      <Tarjeta titulo="Registrar actuación">
        {procesosAbiertos.length === 0 ? (
          <p className="text-sm text-slate-400">No hay procesos abiertos.</p>
        ) : (
          <form action={actAction} className="grid gap-2">
            <select name="procesoId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Proceso —</option>
              {procesosAbiertos.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
            </select>
            <select name="estado" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Nuevo estado —</option>
              <option value="INDAGACION_PRELIMINAR">Indagación preliminar</option>
              <option value="INVESTIGACION">Investigación</option>
              <option value="DESCARGOS">Descargos</option>
              <option value="FALLO">Fallo</option>
              <option value="ARCHIVADO">Archivado</option>
            </select>
            <input name="fecha" type="date" required className={INPUT} />
            <textarea name="descripcion" required rows={2} placeholder="Descripción de la actuación (si el estado es Fallo, este texto queda como la decisión)" className={INPUT} />
            <button type="submit" disabled={actPend} className={BTN}>{actPend ? "Registrando…" : "Registrar actuación"}</button>
          </form>
        )}
        <Mensaje state={actState} />
      </Tarjeta>
    </div>
  )
}

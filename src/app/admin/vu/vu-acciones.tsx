"use client"

import { useActionState } from "react"
import { radicarPqrsdAction, responderPqrsdAction, type VuState } from "./actions"

interface DepOpcion {
  id: string
  etiqueta: string
  compartida: boolean
}
interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeRadicar: boolean
  puedeResponder: boolean
  dependencias: DepOpcion[]
  pendientes: Opcion[]
}

const inicial: VuState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: VuState }) {
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

export function VuAcciones({ puedeRadicar, puedeResponder, dependencias, pendientes }: Props) {
  const [radState, radAction, radPend] = useActionState(radicarPqrsdAction, inicial)
  const [respState, respAction, respPend] = useActionState(responderPqrsdAction, inicial)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {puedeRadicar && (
        <Tarjeta titulo="Radicar PQRSD">
          <form action={radAction} className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <select name="tipo" defaultValue="PETICION" className={INPUT}>
                <option value="PETICION">Petición</option>
                <option value="QUEJA">Queja</option>
                <option value="RECLAMO">Reclamo</option>
                <option value="SUGERENCIA">Sugerencia</option>
                <option value="DENUNCIA">Denuncia</option>
              </select>
              <select name="canal" defaultValue="PRESENCIAL" className={INPUT}>
                <option value="PRESENCIAL">Presencial</option>
                <option value="WEB">Web</option>
                <option value="TELEFONICO">Telefónico</option>
                <option value="EMAIL">Email</option>
                <option value="ESCRITO">Escrito</option>
              </select>
            </div>
            <input name="peticionarioNombre" placeholder="Nombre del peticionario" required className={INPUT} />
            <div className="grid grid-cols-2 gap-2">
              <input name="peticionarioEmail" type="email" placeholder="Correo (opcional)" className={INPUT} />
              <input name="peticionarioTelefono" placeholder="Teléfono (opcional)" className={INPUT} />
            </div>
            <input name="asunto" placeholder="Asunto" required className={INPUT} />
            <textarea name="descripcion" placeholder="Descripción de la solicitud" required rows={3} className={INPUT} />
            <select name="dependenciaId" defaultValue="" className={INPUT}>
              <option value="">— Dependencia competente (auto-rutea a quien la ejerce) —</option>
              {dependencias.map((d) => (
                <option key={d.id} value={d.id}>{d.etiqueta}{d.compartida ? " · compartida" : ""}</option>
              ))}
            </select>
            <button type="submit" disabled={radPend} className={BTN}>{radPend ? "Radicando…" : "Radicar PQRSD"}</button>
          </form>
          <Mensaje state={radState} />
        </Tarjeta>
      )}

      {puedeResponder && (
        <Tarjeta titulo="Responder PQRSD">
          {pendientes.length === 0 ? (
            <p className="text-sm text-slate-400">No hay PQRSD pendientes de respuesta.</p>
          ) : (
            <form action={respAction} className="grid gap-2">
              <select name="id" required defaultValue="" className={INPUT}>
                <option value="" disabled>— PQRSD pendiente —</option>
                {pendientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.etiqueta}</option>
                ))}
              </select>
              <textarea name="respuesta" placeholder="Respuesta oficial al ciudadano" required rows={4} className={INPUT} />
              <button type="submit" disabled={respPend} className={BTN}>{respPend ? "Respondiendo…" : "Enviar respuesta"}</button>
            </form>
          )}
          <Mensaje state={respState} />
        </Tarjeta>
      )}
    </div>
  )
}

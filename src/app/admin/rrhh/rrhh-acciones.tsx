"use client"

import { useActionState } from "react"
import { crearFuncionarioAction, registrarActoAction, registrarAusenciaAction, type AccionState } from "./actions"

interface Opcion {
  id: string
  nombre: string
}
interface CargoOpcion extends Opcion {
  depCodigo: string
}

interface Props {
  puedeGestionarFuncionarios: boolean
  puedeActosAdministrativos: boolean
  funcionarios: Opcion[]
  cargos: CargoOpcion[]
}

const inicial: AccionState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"

function Mensaje({ state }: { state: AccionState }) {
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

export function RrhhAcciones({ puedeGestionarFuncionarios, puedeActosAdministrativos, funcionarios, cargos }: Props) {
  const [funcState, funcAction, funcPend] = useActionState(crearFuncionarioAction, inicial)
  const [actoState, actoAction, actoPend] = useActionState(registrarActoAction, inicial)
  const [ausState, ausAction, ausPend] = useActionState(registrarAusenciaAction, inicial)

  if (!puedeGestionarFuncionarios && !puedeActosAdministrativos) return null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {puedeGestionarFuncionarios && (
        <Tarjeta titulo="Nuevo funcionario">
          <form action={funcAction} className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input name="nombre" placeholder="Nombre" required className={INPUT} />
              <input name="apellido" placeholder="Apellido" required className={INPUT} />
            </div>
            <input name="email" type="email" placeholder="correo@entidad.gov.co" required className={INPUT} />
            <p className="text-xs text-slate-400">Se crea sin contraseña y sin cargo. Regístrale a continuación su acto de posesión.</p>
            <button type="submit" disabled={funcPend} className={BTN}>{funcPend ? "Creando…" : "Crear funcionario"}</button>
          </form>
          <Mensaje state={funcState} />
        </Tarjeta>
      )}

      {puedeActosAdministrativos && (
        <Tarjeta titulo="Acto administrativo (posesión / encargo / provisional)">
          <form action={actoAction} className="grid gap-2">
            <select name="usuarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Funcionario —</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            <select name="cargoId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Cargo —</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>{c.depCodigo} · {c.nombre}</option>
              ))}
            </select>
            <select name="tipo" defaultValue="TITULAR" className={INPUT}>
              <option value="TITULAR">Titular (nombramiento y posesión)</option>
              <option value="ENCARGADO">Encargo (cubre ausencia temporal)</option>
              <option value="PROVISIONAL">Provisional (hasta concurso de méritos)</option>
            </select>
            <input name="actoAdmin" placeholder="Acto admin. (ej. Decreto 045 de 2026)" required className={INPUT} />
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-500">
                Desde
                <input name="desde" type="date" className={INPUT} />
              </label>
              <label className="block text-xs text-slate-500">
                Hasta (opcional)
                <input name="hasta" type="date" className={INPUT} />
              </label>
            </div>
            <button type="submit" disabled={actoPend} className={BTN}>{actoPend ? "Registrando…" : "Registrar acto"}</button>
          </form>
          <Mensaje state={actoState} />
        </Tarjeta>
      )}

      {puedeActosAdministrativos && (
        <Tarjeta titulo="Vacaciones / licencia / incapacidad">
          <form action={ausAction} className="grid gap-2">
            <select name="usuarioId" required defaultValue="" className={INPUT}>
              <option value="" disabled>— Funcionario —</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            <select name="tipo" defaultValue="VACACIONES" className={INPUT}>
              <option value="VACACIONES">Vacaciones</option>
              <option value="LICENCIA">Licencia</option>
              <option value="COMISION">Comisión</option>
              <option value="INCAPACIDAD">Incapacidad</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-500">
                Desde
                <input name="desde" type="date" required className={INPUT} />
              </label>
              <label className="block text-xs text-slate-500">
                Hasta
                <input name="hasta" type="date" required className={INPUT} />
              </label>
            </div>
            <input name="motivo" placeholder="Motivo (opcional)" className={INPUT} />
            <button type="submit" disabled={ausPend} className={BTN}>{ausPend ? "Registrando…" : "Registrar ausencia"}</button>
          </form>
          <Mensaje state={ausState} />
        </Tarjeta>
      )}
    </div>
  )
}

"use client"

import { useActionState } from "react"
import { crearFuncionarioAction, registrarActoAction, registrarAusenciaAction, actualizarSalarioAction, actualizarDatosSSAction, type AccionState } from "./actions"

interface Opcion {
  id: string
  nombre: string
}
interface CargoOpcion extends Opcion {
  depCodigo: string
}
interface VinculacionOpcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeGestionarFuncionarios: boolean
  puedeActosAdministrativos: boolean
  funcionarios: Opcion[]
  cargos: CargoOpcion[]
  vinculacionesVigentes: VinculacionOpcion[]
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

export function RrhhAcciones({ puedeGestionarFuncionarios, puedeActosAdministrativos, funcionarios, cargos, vinculacionesVigentes }: Props) {
  const [funcState, funcAction, funcPend] = useActionState(crearFuncionarioAction, inicial)
  const [actoState, actoAction, actoPend] = useActionState(registrarActoAction, inicial)
  const [ausState, ausAction, ausPend] = useActionState(registrarAusenciaAction, inicial)
  const [salState, salAction, salPend] = useActionState(actualizarSalarioAction, inicial)
  const [ssState, ssAction, ssPend] = useActionState(actualizarDatosSSAction, inicial)

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
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <select name="tipoDocumento" defaultValue="CC" className={INPUT}>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PA">Pasaporte</option>
                <option value="OTRO">Otro</option>
              </select>
              <input name="documento" placeholder="Número de documento" className={INPUT} />
            </div>
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
            <input name="salarioBasico" type="number" min="0" step="1000" placeholder="Salario básico (opcional, para Nómina)" className={INPUT} />
            <button type="submit" disabled={actoPend} className={BTN}>{actoPend ? "Registrando…" : "Registrar acto"}</button>
          </form>
          <Mensaje state={actoState} />
        </Tarjeta>
      )}

      {puedeActosAdministrativos && (
        <Tarjeta titulo="Actualizar salario">
          {vinculacionesVigentes.length === 0 ? (
            <p className="text-sm text-slate-400">No hay vínculos vigentes.</p>
          ) : (
            <form action={salAction} className="grid gap-2">
              <select name="vinculacionId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Vínculo vigente —</option>
                {vinculacionesVigentes.map((v) => (
                  <option key={v.id} value={v.id}>{v.etiqueta}</option>
                ))}
              </select>
              <input name="salarioBasico" type="number" min="0" step="1000" placeholder="Salario básico" required className={INPUT} />
              <p className="text-xs text-slate-400">Corrige o fija el salario de un vínculo ya registrado (sin crear un acto nuevo).</p>
              <button type="submit" disabled={salPend} className={BTN}>{salPend ? "Guardando…" : "Actualizar salario"}</button>
            </form>
          )}
          <Mensaje state={salState} />
        </Tarjeta>
      )}

      {puedeActosAdministrativos && (
        <Tarjeta titulo="Datos de seguridad social">
          {funcionarios.length === 0 ? (
            <p className="text-sm text-slate-400">No hay funcionarios.</p>
          ) : (
            <form action={ssAction} className="grid gap-2">
              <select name="usuarioId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Funcionario —</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nombre}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="codigoEps" placeholder="Código EPS" className={INPUT} />
                <input name="codigoAfp" placeholder="Código AFP" className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="codigoArl" placeholder="Código ARL" className={INPUT} />
                <input name="codigoCaja" placeholder="Código Caja de Compensación" className={INPUT} />
              </div>
              <select name="claseRiesgoArl" defaultValue="" className={INPUT}>
                <option value="">Clase de riesgo ARL (vacío = clase I)</option>
                <option value="1">Clase I</option>
                <option value="2">Clase II</option>
                <option value="3">Clase III</option>
                <option value="4">Clase IV</option>
                <option value="5">Clase V</option>
              </select>
              <p className="text-xs text-slate-400">Códigos de afiliación reales (tal como aparecen en el UGPP/PILA). Necesarios para generar la planilla.</p>
              <button type="submit" disabled={ssPend} className={BTN}>{ssPend ? "Guardando…" : "Guardar datos SS"}</button>
            </form>
          )}
          <Mensaje state={ssState} />
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

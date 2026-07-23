"use client"

import { useActionState } from "react"
import {
  sembrarEstructuraAction,
  crearDependenciaAction,
  crearCargoAction,
  type AccionState,
} from "./actions"

interface Opcion {
  id: string
  nombre: string
}
interface DepOpcion extends Opcion {
  codigo: string
}
interface EmpleoOpcion {
  id: string
  codigo: string
  denominacion: string
}
interface CargoOpcion extends Opcion {
  depCodigo: string
}

interface Props {
  tipoEntidad: string
  hayPlantilla: boolean
  dependencias: DepOpcion[]
  empleos: EmpleoOpcion[]
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

export function EstructuraAcciones({ tipoEntidad, hayPlantilla, dependencias, empleos, cargos }: Props) {
  const [sembrarState, sembrarAction, sembrando] = useActionState(async () => sembrarEstructuraAction(), inicial)
  const [depState, depAction, depPend] = useActionState(crearDependenciaAction, inicial)
  const [cargoState, cargoAction, cargoPend] = useActionState(crearCargoAction, inicial)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {hayPlantilla && (
        <Tarjeta titulo={`Sembrar estructura (plantilla ${tipoEntidad})`}>
          <p className="mb-3 text-xs text-slate-500">
            Crea el árbol de dependencias y cargos base del tipo de entidad. Idempotente: no duplica lo ya sembrado.
          </p>
          <form action={sembrarAction}>
            <button type="submit" disabled={sembrando} className={BTN}>
              {sembrando ? "Sembrando…" : "Sembrar estructura"}
            </button>
          </form>
          <Mensaje state={sembrarState} />
        </Tarjeta>
      )}

      <Tarjeta titulo="Nueva dependencia">
        <form action={depAction} className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input name="codigo" placeholder="Código (ej. HAC)" required className={INPUT} />
            <select name="tipo" defaultValue="SECRETARIA" className={INPUT}>
              {["DESPACHO", "SECRETARIA", "SUBSECRETARIA", "DIRECCION", "OFICINA"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <input name="nombre" placeholder="Nombre" required className={INPUT} />
          <select name="padreId" defaultValue="" className={INPUT}>
            <option value="">— Sin dependencia padre —</option>
            {dependencias.map((d) => (
              <option key={d.id} value={d.id}>{d.codigo} · {d.nombre}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="esServicioCompartido" /> Servicio compartido (transversal)
          </label>
          <button type="submit" disabled={depPend} className={BTN}>{depPend ? "Creando…" : "Crear dependencia"}</button>
        </form>
        <Mensaje state={depState} />
      </Tarjeta>

      <Tarjeta titulo="Nuevo cargo">
        <form action={cargoAction} className="grid gap-2">
          <select name="dependenciaId" required defaultValue="" className={INPUT}>
            <option value="" disabled>— Dependencia —</option>
            {dependencias.map((d) => (
              <option key={d.id} value={d.id}>{d.codigo} · {d.nombre}</option>
            ))}
          </select>
          <input name="nombre" placeholder="Nombre del cargo (ej. Profesional Especializado — Banco de Proyectos)" required className={INPUT} />
          <select name="empleoId" defaultValue="" className={INPUT}>
            <option value="">— Sin empleo (elección/período fijo) —</option>
            {empleos.map((e) => (
              <option key={e.id} value={e.id}>{e.codigo} · {e.denominacion}</option>
            ))}
          </select>
          <textarea name="funciones" placeholder="Funciones específicas de este cargo (ej. Estratificación socioeconómica municipal)" rows={2} className={INPUT} />
          <select name="jefeInmediatoId" defaultValue="" className={INPUT}>
            <option value="">— Sin jefe inmediato específico —</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>{c.depCodigo} · {c.nombre}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="esJefatura" /> Es jefatura (cabeza de la dependencia)
          </label>
          <p className="text-xs text-slate-400">Los permisos (grants) se ajustan luego; nace sin capacidades.</p>
          <button type="submit" disabled={cargoPend} className={BTN}>{cargoPend ? "Creando…" : "Crear cargo"}</button>
        </form>
        <Mensaje state={cargoState} />
      </Tarjeta>

      <Tarjeta titulo="Funcionarios y actos administrativos">
        <p className="text-sm text-slate-500">
          Crear funcionarios y registrar sus actos (posesión, encargo, provisional, vacaciones) se
          gestiona ahora desde <span className="font-medium">Talento Humano</span> — capacidad{" "}
          <code>gestion_humana</code>, no administración de la estructura.
        </p>
      </Tarjeta>
    </div>
  )
}

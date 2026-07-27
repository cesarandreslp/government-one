"use client"

import { useActionState } from "react"
import { crearPeriodoAction, crearEjeAction, crearProgramaAction, crearMetaAction, reportarSeguimientoAction, type PdmState } from "./actions"

interface Opcion {
  id: string
  etiqueta: string
}

interface Props {
  puedeAdministrar: boolean
  puedeReportarAvance: boolean
  periodos: Opcion[]
  ejes: Opcion[]
  programas: Opcion[]
  dependencias: Opcion[]
  metas: Opcion[]
}

const inicial: PdmState = {}
const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const BTN = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
const ANIO_ACTUAL = new Date().getFullYear()

function Mensaje({ state }: { state: PdmState }) {
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

export function PdmAcciones({ puedeAdministrar, puedeReportarAvance, periodos, ejes, programas, dependencias, metas }: Props) {
  const [periodoState, periodoAction, periodoPend] = useActionState(crearPeriodoAction, inicial)
  const [ejeState, ejeAction, ejePend] = useActionState(crearEjeAction, inicial)
  const [programaState, programaAction, programaPend] = useActionState(crearProgramaAction, inicial)
  const [metaState, metaAction, metaPend] = useActionState(crearMetaAction, inicial)
  const [segState, segAction, segPend] = useActionState(reportarSeguimientoAction, inicial)

  return (
    <div className="grid gap-4">
      {puedeAdministrar && (
        <div className="grid gap-4 md:grid-cols-2">
          <Tarjeta titulo="Nuevo Plan de Desarrollo (periodo)">
            <form action={periodoAction} className="grid gap-2">
              <input name="nombre" required placeholder='Nombre (ej. "Plan de Desarrollo 2024-2027")' className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <input name="vigenciaInicio" type="number" required placeholder="Año inicio" defaultValue={ANIO_ACTUAL} className={INPUT} />
                <input name="vigenciaFin" type="number" required placeholder="Año fin" defaultValue={ANIO_ACTUAL + 3} className={INPUT} />
              </div>
              <button type="submit" disabled={periodoPend} className={BTN}>{periodoPend ? "Creando…" : "Crear periodo"}</button>
            </form>
            <Mensaje state={periodoState} />
          </Tarjeta>

          <Tarjeta titulo="Nuevo eje estratégico">
            {periodos.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas al menos un periodo.</p>
            ) : (
              <form action={ejeAction} className="grid gap-2">
                <select name="periodoId" required defaultValue="" className={INPUT}>
                  <option value="" disabled>— Plan de Desarrollo —</option>
                  {periodos.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                </select>
                <input name="nombre" required placeholder="Nombre del eje" className={INPUT} />
                <button type="submit" disabled={ejePend} className={BTN}>{ejePend ? "Creando…" : "Crear eje"}</button>
              </form>
            )}
            <Mensaje state={ejeState} />
          </Tarjeta>

          <Tarjeta titulo="Nuevo programa">
            {ejes.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas al menos un eje.</p>
            ) : (
              <form action={programaAction} className="grid gap-2">
                <select name="ejeId" required defaultValue="" className={INPUT}>
                  <option value="" disabled>— Eje —</option>
                  {ejes.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
                </select>
                <input name="nombre" required placeholder="Nombre del programa" className={INPUT} />
                <select name="dependenciaId" defaultValue="" className={INPUT}>
                  <option value="">— Dependencia responsable (opcional) —</option>
                  {dependencias.map((d) => <option key={d.id} value={d.id}>{d.etiqueta}</option>)}
                </select>
                <button type="submit" disabled={programaPend} className={BTN}>{programaPend ? "Creando…" : "Crear programa"}</button>
              </form>
            )}
            <Mensaje state={programaState} />
          </Tarjeta>

          <Tarjeta titulo="Nueva meta">
            {programas.length === 0 ? (
              <p className="text-sm text-slate-400">Necesitas al menos un programa.</p>
            ) : (
              <form action={metaAction} className="grid gap-2">
                <select name="programaId" required defaultValue="" className={INPUT}>
                  <option value="" disabled>— Programa —</option>
                  {programas.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
                </select>
                <select name="tipo" required defaultValue="PRODUCTO" className={INPUT}>
                  <option value="PRODUCTO">Producto</option>
                  <option value="RESULTADO">Resultado</option>
                </select>
                <input name="indicador" required placeholder='Indicador (ej. "Km de vía urbana pavimentados")' className={INPUT} />
                <input name="unidadMedida" required placeholder='Unidad de medida (ej. "km", "personas")' className={INPUT} />
                <div className="grid grid-cols-2 gap-2">
                  <input name="lineaBase" type="number" min="0" step="0.01" required placeholder="Línea base" className={INPUT} />
                  <input name="metaCuatrienio" type="number" min="0.01" step="0.01" required placeholder="Meta del cuatrienio" className={INPUT} />
                </div>
                <button type="submit" disabled={metaPend} className={BTN}>{metaPend ? "Creando…" : "Crear meta"}</button>
              </form>
            )}
            <Mensaje state={metaState} />
          </Tarjeta>
        </div>
      )}

      {puedeReportarAvance && (
        <Tarjeta titulo="Reportar seguimiento (avance acumulado por vigencia)">
          {metas.length === 0 ? (
            <p className="text-sm text-slate-400">Necesitas al menos una meta.</p>
          ) : (
            <form action={segAction} className="grid gap-2">
              <select name="metaId" required defaultValue="" className={INPUT}>
                <option value="" disabled>— Meta —</option>
                {metas.map((m) => <option key={m.id} value={m.id}>{m.etiqueta}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="vigencia" type="number" required defaultValue={ANIO_ACTUAL} className={INPUT} />
                <input name="valorAcumulado" type="number" min="0" step="0.01" required placeholder="Valor acumulado" className={INPUT} />
              </div>
              <textarea name="observacion" rows={2} placeholder="Observación (opcional)" className={INPUT} />
              <button type="submit" disabled={segPend} className={BTN}>{segPend ? "Registrando…" : "Registrar seguimiento"}</button>
            </form>
          )}
          <Mensaje state={segState} />
        </Tarjeta>
      )}
    </div>
  )
}

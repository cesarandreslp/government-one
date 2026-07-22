import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { ejecucionProyecto } from "@/lib/proyectos/ejecucion"
import { ProyectosAcciones } from "./proyectos-acciones"

export const dynamic = "force-dynamic"

const RIESGO_COLOR: Record<string, string> = {
  BAJO: "bg-emerald-100 text-emerald-800",
  MEDIO: "bg-amber-100 text-amber-800",
  ALTO: "bg-red-100 text-red-700",
}
const ESTADO_COLOR: Record<string, string> = {
  FORMULACION: "bg-slate-100 text-slate-700",
  EJECUCION: "bg-blue-100 text-blue-700",
  SUSPENDIDO: "bg-amber-100 text-amber-800",
  CERRADO: "bg-slate-200 text-slate-600",
}

export default async function ProyectosPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeAdministrar, puedeReportarAvance] = await Promise.all([
    funcionarioPuede(ctx, "banco_proyectos", "administrar"),
    funcionarioPuede(ctx, "banco_proyectos", "reportar_avance"),
  ])

  const [proyectos, dependencias] = await Promise.all([
    db.proyecto.findMany({ orderBy: { createdAt: "desc" }, include: { dependencia: true, hitos: true } }),
    db.dependencia.findMany({ where: { activa: true }, orderBy: { codigo: "asc" } }),
  ])

  const ejecuciones = await Promise.all(
    proyectos.map((p) => ejecucionProyecto(db, p.id, p.valorTotal ? Number(p.valorTotal) : null)),
  )

  const sinAcceso = !puedeAdministrar && !puedeReportarAvance
  const enRiesgoAlto = ejecuciones.filter((e) => e.riesgo === "ALTO").length
  const fisicaPromedio = ejecuciones.length
    ? Math.round((ejecuciones.reduce((s, e) => s + e.fisica.porcentaje, 0) / ejecuciones.length) * 10) / 10
    : 0

  const hitosOpciones = proyectos.flatMap((p) =>
    p.hitos.map((h) => ({ id: h.id, etiqueta: `${p.codigo} · ${h.nombre} (${Number(h.pesoPorcentual)}%, hoy ${Number(h.avancePorcentual)}%)` })),
  )

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Banco de Proyectos</h1>
        <p className="text-sm text-slate-500">
          Ejecución financiera vs. física — la brecha entre ambas es la señal de riesgo (ej. anticipo pagado sin obra ejecutada).
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{proyectos.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Proyectos</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{fisicaPromedio}%</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Avance físico prom.</div>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${enRiesgoAlto > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
          <div className={`text-2xl font-semibold ${enRiesgoAlto > 0 ? "text-red-700" : "text-slate-800"}`}>{enRiesgoAlto}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">En riesgo ALTO</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{proyectos.reduce((s, p) => s + p.hitos.length, 0)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Hitos</div>
        </div>
      </div>

      {sinAcceso && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Banco de Proyectos. Pídele a un administrador que te asigne un cargo con
          <span className="font-mono"> banco_proyectos</span> (administrar / reportar_avance).
        </div>
      )}

      <ProyectosAcciones
        puedeAdministrar={puedeAdministrar}
        puedeReportarAvance={puedeReportarAvance}
        dependencias={dependencias.map((d) => ({ id: d.id, etiqueta: `${d.codigo} · ${d.nombre}` }))}
        proyectos={proyectos.map((p) => ({ id: p.id, etiqueta: `${p.codigo} · ${p.nombre}` }))}
        hitos={hitosOpciones}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Proyectos</h2>
        {proyectos.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay proyectos.</p>
        ) : (
          <div className="space-y-3">
            {proyectos.map((p, i) => {
              const ej = ejecuciones[i]
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-slate-500">{p.codigo}</span>
                      <span className="ml-2 font-medium text-slate-800">{p.nombre}</span>
                      <span className="ml-2 text-xs text-slate-400">{p.dependencia.codigo} · {p.vigencia}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[p.estado]}`}>{p.estado}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RIESGO_COLOR[ej.riesgo]}`}>Riesgo {ej.riesgo}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>Financiera</span><span>{ej.financiera.porcentaje}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${ej.financiera.porcentaje}%` }} /></div>
                      <div className="mt-1 text-xs text-slate-400">Pagado ${ej.financiera.pagado.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>Física</span><span>{ej.fisica.porcentaje}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${ej.fisica.porcentaje}%` }} /></div>
                      <div className="mt-1 text-xs text-slate-400">{ej.fisica.hitosCompletos}/{ej.fisica.totalHitos} hitos completos</div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-slate-500">Brecha</div>
                      <div className={`text-lg font-semibold ${ej.brecha > 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {ej.brecha > 0 ? "+" : ""}{ej.brecha}pp
                      </div>
                    </div>
                  </div>
                  {p.hitos.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-slate-500">Ver {p.hitos.length} hito(s)</summary>
                      <ul className="mt-2 space-y-1">
                        {p.hitos.map((h) => (
                          <li key={h.id} className="flex items-center justify-between border-l-2 border-slate-100 pl-3 text-sm">
                            <span className="text-slate-700">{h.nombre} <span className="text-xs text-slate-400">({Number(h.pesoPorcentual)}%)</span></span>
                            <span className="font-mono text-xs text-slate-500">{Number(h.avancePorcentual)}%</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

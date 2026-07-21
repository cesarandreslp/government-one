import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { GdAcciones } from "./gd-acciones"

export const dynamic = "force-dynamic"

const TIPO_LABEL: Record<string, string> = { ENTRADA: "Entrada", SALIDA: "Salida", INTERNO: "Interno" }
const ESTADO_COLOR: Record<string, string> = {
  RADICADO: "bg-blue-100 text-blue-700",
  EN_TRAMITE: "bg-amber-100 text-amber-800",
  RESPONDIDO: "bg-emerald-100 text-emerald-800",
  ARCHIVADO: "bg-slate-200 text-slate-700",
  ANULADO: "bg-red-100 text-red-700",
}

export default async function GdPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeRadicar, puedeTrd, puedeArchivar] = await Promise.all([
    funcionarioPuede(ctx, "gestion_documental", "radicar"),
    funcionarioPuede(ctx, "gestion_documental", "administrar_trd"),
    funcionarioPuede(ctx, "gestion_documental", "archivar"),
  ])

  const [series, dependencias, radicados] = await Promise.all([
    db.gdSerie.findMany({ orderBy: { codigo: "asc" }, include: { subseries: { orderBy: { codigo: "asc" } }, dependencia: true } }),
    db.dependencia.findMany({ orderBy: { codigo: "asc" } }),
    db.radicado.findMany({
      orderBy: { fechaRadicado: "desc" },
      take: 100,
      include: { dependencia: true, subserie: true, radicadoPor: true },
    }),
  ])

  const porEstado = radicados.reduce<Record<string, number>>((acc, r) => {
    acc[r.estado] = (acc[r.estado] ?? 0) + 1
    return acc
  }, {})

  const sinAcceso = !puedeRadicar && !puedeTrd
  const subseriesFlat = series.flatMap((s) =>
    s.subseries.map((ss) => ({ id: ss.id, etiqueta: `${s.dependencia.codigo} · ${s.codigo}.${ss.codigo} — ${ss.nombre}` })),
  )

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Gestión Documental</h1>
        <p className="text-sm text-slate-500">
          {radicados.length} radicado(s) · {series.length} serie(s) TRD · {subseriesFlat.length} subserie(s).
        </p>
      </header>

      {/* KPIs por estado */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["RADICADO", "EN_TRAMITE", "RESPONDIDO", "ARCHIVADO"].map((e) => (
          <div key={e} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-semibold text-slate-800">{porEstado[e] ?? 0}</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{e}</div>
          </div>
        ))}
      </div>

      {sinAcceso && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Gestión Documental. Pídele a un administrador que te asigne un cargo con
          <span className="font-mono"> gestion_documental</span> (radicar / administrar_trd).
        </div>
      )}

      <GdAcciones
        puedeRadicar={puedeRadicar}
        puedeTrd={puedeTrd}
        dependencias={dependencias.map((d) => ({ id: d.id, etiqueta: `${d.codigo} · ${d.nombre}` }))}
        series={series.map((s) => ({ id: s.id, etiqueta: `${s.dependencia.codigo} · ${s.codigo} — ${s.nombre}` }))}
        subseries={subseriesFlat}
      />

      {/* TRD */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tabla de Retención Documental</h2>
        {series.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
            Aún no hay series documentales.
          </p>
        ) : (
          <div className="space-y-3">
            {series.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{s.dependencia.codigo}·{s.codigo}</span>
                  <span className="font-medium text-slate-800">{s.nombre}</span>
                  <span className="text-xs text-slate-400">{s.dependencia.nombre}</span>
                </div>
                {s.subseries.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {s.subseries.map((ss) => (
                      <li key={ss.id} className="flex flex-wrap items-center gap-2 border-l-2 border-slate-100 pl-3 text-sm text-slate-600">
                        <span className="font-mono text-xs text-slate-500">{ss.codigo}</span>
                        <span>{ss.nombre}</span>
                        {(ss.retencionGestion != null || ss.retencionCentral != null) && (
                          <span className="text-xs text-slate-400">retención {ss.retencionGestion ?? "–"}/{ss.retencionCentral ?? "–"} años</span>
                        )}
                        {ss.disposicion && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">{ss.disposicion}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bandeja de radicados */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Bandeja de radicados</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Tercero</th>
                <th className="px-4 py-3">Dependencia</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {radicados.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aún no hay radicados.</td></tr>
              )}
              {radicados.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{TIPO_LABEL[r.tipo]}</td>
                  <td className="px-4 py-3 text-slate-800">{r.asunto}</td>
                  <td className="px-4 py-3 text-slate-500">{r.tercero ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.dependencia?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[r.estado] ?? "bg-slate-100 text-slate-700"}`}>
                      {r.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {puedeArchivar && radicados.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">Tienes la capacidad de archivar/cambiar estado (acción por radicado disponible en una iteración siguiente).</p>
        )}
      </section>
    </main>
  )
}

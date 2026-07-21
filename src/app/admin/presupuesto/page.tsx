import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { PresupuestoAcciones } from "./presupuesto-acciones"

export const dynamic = "force-dynamic"

export default async function PresupuestoPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeAdministrar, puedeExpedirCdp] = await Promise.all([
    funcionarioPuede(ctx, "presupuesto", "administrar"),
    funcionarioPuede(ctx, "presupuesto", "expedir_cdp"),
  ])

  const [rubros, apropiaciones, cdps] = await Promise.all([
    db.rubroPresupuestal.findMany({ orderBy: { codigo: "asc" } }),
    db.apropiacion.findMany({ orderBy: [{ vigencia: "desc" }, { rubro: { codigo: "asc" } }], include: { rubro: true } }),
    db.cdp.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { rubro: true } }),
  ])

  const rubrosHojaGasto = rubros.filter((r) => r.permiteMovimientos && r.activo && r.tipo === "GASTO")
  const sinAcceso = !puedeAdministrar && !puedeExpedirCdp

  const cdpsVigentesPorRubroVigencia = new Map<string, number>()
  for (const c of cdps) {
    if (c.estado !== "VIGENTE") continue
    const clave = `${c.rubroId}:${c.vigencia}`
    cdpsVigentesPorRubroVigencia.set(clave, (cdpsVigentesPorRubroVigencia.get(clave) ?? 0) + Number(c.valor))
  }
  // Los CDP recientes (take 50) pueden no cubrir todo el histórico de una apropiación vieja;
  // para las tarjetas de apropiación se recalcula el comprometido con una consulta agregada.
  const comprometidoPorApropiacion = await Promise.all(
    apropiaciones.map(async (a) => {
      const vigentes = await db.cdp.findMany({ where: { rubroId: a.rubroId, vigencia: a.vigencia, estado: "VIGENTE" }, select: { valor: true } })
      return vigentes.reduce((s, c) => s + Number(c.valor), 0)
    }),
  )

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Presupuesto</h1>
        <p className="text-sm text-slate-500">
          {rubros.length} rubro(s) del CCPET · {apropiaciones.length} apropiación(es) · {cdps.length} CDP recientes.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{rubros.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Rubros CCPET</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{apropiaciones.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Apropiaciones</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{cdps.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">CDP</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{cdps.filter((c) => c.estado === "VIGENTE").length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">CDP vigentes</div>
        </div>
      </div>

      {sinAcceso && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Presupuesto. Pídele a un administrador que te asigne un cargo con
          <span className="font-mono"> presupuesto</span> (administrar / expedir_cdp).
        </div>
      )}

      <PresupuestoAcciones
        puedeAdministrar={puedeAdministrar}
        puedeExpedirCdp={puedeExpedirCdp}
        clasificacionVacia={rubros.length === 0}
        rubrosGasto={rubrosHojaGasto.map((r) => ({ id: r.id, etiqueta: `${r.codigo} · ${r.nombre}` }))}
      />

      {/* Apropiaciones */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Apropiaciones</h2>
        {apropiaciones.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay apropiaciones.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rubro</th>
                  <th className="px-4 py-3">Vigencia</th>
                  <th className="px-4 py-3 text-right">Apropiado</th>
                  <th className="px-4 py-3 text-right">Comprometido</th>
                  <th className="px-4 py-3 text-right">Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apropiaciones.map((a, i) => {
                  const total = Number(a.apropiacionInicial) + Number(a.adiciones) - Number(a.reducciones)
                  const comprometido = comprometidoPorApropiacion[i]
                  const disponible = total - comprometido
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{a.rubro.codigo} · {a.rubro.nombre}</td>
                      <td className="px-4 py-3 text-slate-500">{a.vigencia}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">${total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">${comprometido.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-mono text-xs ${disponible < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        ${disponible.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CDP recientes */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">CDP recientes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Rubro</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Objeto</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cdps.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aún no hay CDP.</td></tr>
              )}
              {cdps.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{c.rubro.codigo}</td>
                  <td className="px-4 py-3 text-slate-500">{c.fecha.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-800">{c.objeto}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">${Number(c.valor).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.estado === "VIGENTE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Clasificación (colapsable por ser grande: 1784 rubros) */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Clasificación presupuestal (CCPET)</h2>
        {rubros.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay clasificación sembrada.</p>
        ) : (
          <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-4 py-3 text-sm text-slate-600">
              Ver los {rubros.length} rubros (Ingresos + Gastos, hasta 10 niveles)
            </summary>
            <div className="max-h-96 overflow-y-auto border-t border-slate-100">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {rubros.map((r) => (
                    <tr key={r.id} className={r.permiteMovimientos ? "" : "bg-slate-50/60"}>
                      <td className="px-4 py-1.5 font-mono text-xs text-slate-500" style={{ paddingLeft: `${1 + (r.nivel - 1) * 1}rem` }}>
                        {r.codigo}
                      </td>
                      <td className={`px-4 py-1.5 ${r.permiteMovimientos ? "text-slate-800" : "font-medium text-slate-600"}`}>{r.nombre}</td>
                      <td className="px-4 py-1.5 text-right text-xs text-slate-400">{r.tipo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>
    </main>
  )
}

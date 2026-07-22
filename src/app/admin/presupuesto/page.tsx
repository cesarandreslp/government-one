import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { PresupuestoAcciones } from "./presupuesto-acciones"

export const dynamic = "force-dynamic"

export default async function PresupuestoPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeAdministrar, puedeExpedirCdp, puedeExpedirRp] = await Promise.all([
    funcionarioPuede(ctx, "presupuesto", "administrar"),
    funcionarioPuede(ctx, "presupuesto", "expedir_cdp"),
    funcionarioPuede(ctx, "presupuesto", "expedir_rp"),
  ])

  const [rubros, apropiaciones, cdps, rps, obligaciones, pagos, cuentas, terceros] = await Promise.all([
    db.rubroPresupuestal.findMany({ orderBy: { codigo: "asc" } }),
    db.apropiacion.findMany({ orderBy: [{ vigencia: "desc" }, { rubro: { codigo: "asc" } }], include: { rubro: true } }),
    db.cdp.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { rubro: true } }),
    db.rp.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { cdp: true, tercero: true } }),
    db.obligacion.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { rp: true } }),
    db.pago.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { obligacion: true, comprobante: true } }),
    db.planCuenta.findMany({ where: { permiteMovimientos: true, activa: true }, orderBy: { codigo: "asc" } }),
    db.tercero.findMany({ orderBy: { razonSocial: "asc" } }),
  ])

  const rubrosHojaGasto = rubros.filter((r) => r.permiteMovimientos && r.activo && r.tipo === "GASTO")
  const cdpsVigentesOpciones = cdps.filter((c) => c.estado === "VIGENTE")
  const rpsVigentesOpciones = rps.filter((r) => r.estado === "VIGENTE")
  const obligacionesVigentesOpciones = obligaciones.filter((o) => o.estado === "VIGENTE")
  const cuentasGasto = cuentas.filter((c) => c.codigo.startsWith("5"))
  const cuentasBanco = cuentas.filter((c) => c.codigo.startsWith("11"))
  const sinAcceso = !puedeAdministrar && !puedeExpedirCdp && !puedeExpedirRp

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
          <span className="font-mono"> presupuesto</span> (administrar / expedir_cdp / expedir_rp).
        </div>
      )}

      <PresupuestoAcciones
        puedeAdministrar={puedeAdministrar}
        puedeExpedirCdp={puedeExpedirCdp}
        puedeExpedirRp={puedeExpedirRp}
        clasificacionVacia={rubros.length === 0}
        rubrosGasto={rubrosHojaGasto.map((r) => ({ id: r.id, etiqueta: `${r.codigo} · ${r.nombre}` }))}
        cdpsVigentes={cdpsVigentesOpciones.map((c) => ({ id: c.id, etiqueta: `${c.numero} · ${c.rubro.codigo}` }))}
        rpsVigentes={rpsVigentesOpciones.map((r) => ({ id: r.id, etiqueta: `${r.numero} · ${r.cdp.numero}` }))}
        obligacionesVigentes={obligacionesVigentesOpciones.map((o) => ({ id: o.id, etiqueta: `${o.numero} · ${o.rp.numero}` }))}
        terceros={terceros.map((t) => ({ id: t.id, etiqueta: `${t.documento} · ${t.razonSocial}` }))}
        cuentasGasto={cuentasGasto.map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.nombre}` }))}
        cuentasBanco={cuentasBanco.map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.nombre}` }))}
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

      {/* RP recientes */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">RP recientes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">CDP</th>
                <th className="px-4 py-3">Tercero</th>
                <th className="px-4 py-3">Objeto</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rps.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aún no hay RP.</td></tr>
              )}
              {rps.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{r.cdp.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{r.tercero?.razonSocial ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-800">{r.objeto}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">${Number(r.valor).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.estado === "VIGENTE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                      {r.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Obligaciones recientes */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Obligaciones recientes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">RP</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {obligaciones.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aún no hay obligaciones.</td></tr>
              )}
              {obligaciones.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{o.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{o.rp.numero}</td>
                  <td className="px-4 py-3 text-slate-800">{o.concepto}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">${Number(o.valor).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.estado === "VIGENTE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                      {o.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pagos recientes */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Pagos recientes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Obligación</th>
                <th className="px-4 py-3">Medio</th>
                <th className="px-4 py-3">Comprobante</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aún no hay pagos.</td></tr>
              )}
              {pagos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{p.obligacion.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{p.medioPago}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.comprobante.numero}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">${Number(p.valor).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.estado === "VIGENTE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                      {p.estado}
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

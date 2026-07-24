import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { RentasAcciones } from "./rentas-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  PAGADA: "bg-emerald-100 text-emerald-800",
  ANULADA: "bg-slate-200 text-slate-700",
}

function money(n: unknown): string {
  return `$${Number(n).toLocaleString("es-CO")}`
}

export default async function RentasPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar, puedeLiquidar, puedeRecaudar] = await Promise.all([
    funcionarioPuede(ctx, "rentas", "consultar"),
    funcionarioPuede(ctx, "rentas", "administrar"),
    funcionarioPuede(ctx, "rentas", "liquidar"),
    funcionarioPuede(ctx, "rentas", "recaudar"),
  ])
  const sinAcceso = !puedeConsultar && !puedeAdministrar && !puedeLiquidar && !puedeRecaudar

  if (sinAcceso) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Rentas</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Rentas. Pídele a un administrador un cargo con{" "}
          <span className="font-mono">rentas</span> (consultar / administrar / liquidar / recaudar).
        </p>
      </main>
    )
  }

  const [terceros, predios, actividades, establecimientos, tarifas, liquidaciones, cuentasBanco, rubrosIngreso] = await Promise.all([
    db.tercero.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    db.rentaPredio.findMany({ where: { activo: true }, include: { contribuyente: true }, orderBy: { numeroPredial: "asc" } }),
    db.rentaActividadEconomica.findMany({ where: { activa: true }, orderBy: { codigo: "asc" } }),
    db.rentaEstablecimiento.findMany({ where: { activo: true }, include: { contribuyente: true, actividad: true }, orderBy: { nombreComercial: "asc" } }),
    db.rentaTarifaPredial.findMany({ orderBy: [{ vigencia: "desc" }, { destino: "asc" }] }),
    db.rentaLiquidacion.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { predio: true, establecimiento: true } }),
    db.planCuenta.findMany({ where: { permiteMovimientos: true, activa: true, codigo: { startsWith: "11" } }, orderBy: { codigo: "asc" } }),
    db.rubroPresupuestal.findMany({ where: { tipo: "INGRESO", permiteMovimientos: true, activo: true }, orderBy: { codigo: "asc" } }),
  ])

  const pendientes = liquidaciones.filter((l) => l.estado === "PENDIENTE")
  const hoy = new Date()
  const carteraTotal = pendientes.reduce((s, l) => s + Number(l.valor), 0)
  const carteraVencida = pendientes.filter((l) => l.fechaVencimiento < hoy).reduce((s, l) => s + Number(l.valor), 0)
  const recaudadoTotal = liquidaciones.filter((l) => l.estado === "PAGADA").reduce((s, l) => s + Number(l.valor), 0)

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Rentas</h1>
        <p className="text-sm text-slate-500">
          {predios.length} predio(s) · {establecimientos.length} establecimiento(s) · impuesto predial e ICA.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{money(recaudadoTotal)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Recaudado</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{money(carteraTotal)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Cartera pendiente</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-red-600">{money(carteraVencida)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Cartera vencida</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{liquidaciones.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Liquidaciones recientes</div>
        </div>
      </div>

      <RentasAcciones
        puedeAdministrar={puedeAdministrar}
        puedeLiquidar={puedeLiquidar}
        puedeRecaudar={puedeRecaudar}
        terceros={terceros.map((t) => ({ id: t.id, etiqueta: `${t.documento} · ${t.razonSocial}` }))}
        predios={predios.map((p) => ({ id: p.id, etiqueta: `${p.numeroPredial} · ${p.contribuyente.razonSocial}` }))}
        actividades={actividades.map((a) => ({ id: a.id, etiqueta: `${a.codigo} · ${a.nombre} (${Number(a.tarifaXMil)}‰)` }))}
        establecimientos={establecimientos.map((e) => ({ id: e.id, etiqueta: `${e.nombreComercial} · ${e.contribuyente.razonSocial}` }))}
        cuentasBanco={cuentasBanco.map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.nombre}` }))}
        rubrosIngreso={rubrosIngreso.map((r) => ({ id: r.id, etiqueta: `${r.codigo} · ${r.nombre}` }))}
        liquidacionesPendientes={pendientes.map((l) => ({
          id: l.id,
          etiqueta: `${l.numero} · ${l.predio?.numeroPredial ?? l.establecimiento?.nombreComercial ?? ""} — ${money(l.valor)}`,
        }))}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tarifas prediales vigentes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3 text-right">Avalúo desde</th>
                <th className="px-4 py-3 text-right">Avalúo hasta</th>
                <th className="px-4 py-3 text-right">Tarifa ‰</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tarifas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aún no hay tarifas registradas.</td></tr>
              )}
              {tarifas.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{t.vigencia}</td>
                  <td className="px-4 py-3 text-slate-700">{t.destino}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{money(t.avaluoDesde)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{t.avaluoHasta ? money(t.avaluoHasta) : "sin tope"}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{Number(t.tarifaXMil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Predios</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número predial</th>
                <th className="px-4 py-3">Contribuyente</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3 text-right">Avalúo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {predios.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aún no hay predios registrados.</td></tr>
              )}
              {predios.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.numeroPredial}</td>
                  <td className="px-4 py-3 text-slate-800">{p.contribuyente.razonSocial}</td>
                  <td className="px-4 py-3 text-slate-500">{p.destino}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{money(p.avaluoCatastral)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Establecimientos (ICA)</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Establecimiento</th>
                <th className="px-4 py-3">Contribuyente</th>
                <th className="px-4 py-3">Actividad</th>
                <th className="px-4 py-3 text-right">Tarifa ‰</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {establecimientos.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aún no hay establecimientos registrados.</td></tr>
              )}
              {establecimientos.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{e.nombreComercial}</td>
                  <td className="px-4 py-3 text-slate-500">{e.contribuyente.razonSocial}</td>
                  <td className="px-4 py-3 text-slate-500">{e.actividad.codigo} · {e.actividad.nombre}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{Number(e.actividad.tarifaXMil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Liquidaciones recientes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Sujeto</th>
                <th className="px-4 py-3">Vigencia</th>
                <th className="px-4 py-3 text-right">Base gravable</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liquidaciones.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aún no hay liquidaciones.</td></tr>
              )}
              {liquidaciones.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{l.numero}</td>
                  <td className="px-4 py-3 text-slate-800">{l.predio?.numeroPredial ?? l.establecimiento?.nombreComercial ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{l.vigencia}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{money(l.baseGravable)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{money(l.valor)}</td>
                  <td className="px-4 py-3 text-slate-500">{l.fechaVencimiento.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[l.estado] ?? "bg-slate-100 text-slate-700"}`}>{l.estado}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

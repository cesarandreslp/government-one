import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { empleadosLiquidables } from "@/lib/nomina/salario"
import { NominaAcciones } from "./nomina-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  ABIERTO: "bg-amber-100 text-amber-800",
  LIQUIDADO: "bg-blue-100 text-blue-700",
  PAGADO: "bg-emerald-100 text-emerald-800",
  CERRADO: "bg-slate-200 text-slate-700",
}

function money(n: unknown): string {
  return `$${Number(n).toLocaleString("es-CO")}`
}

export default async function NominaPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeLiquidar, puedePagar] = await Promise.all([
    funcionarioPuede(ctx, "nomina", "consultar"),
    funcionarioPuede(ctx, "nomina", "liquidar"),
    funcionarioPuede(ctx, "nomina", "pagar"),
  ])
  const sinAcceso = !puedeConsultar && !puedeLiquidar && !puedePagar

  if (sinAcceso) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Nómina</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Nómina. Pídele a un administrador un cargo con{" "}
          <span className="font-mono">nomina</span> (consultar / liquidar / pagar).
        </p>
      </main>
    )
  }

  const [periodos, conceptos, liquidaciones, cuentas, empleados] = await Promise.all([
    db.periodoNomina.findMany({ orderBy: { codigo: "desc" } }),
    db.conceptoNomina.findMany({ orderBy: { orden: "asc" } }),
    db.liquidacionNomina.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { usuario: true, periodo: true } }),
    db.planCuenta.findMany({ where: { permiteMovimientos: true, activa: true, codigo: { startsWith: "11" } }, orderBy: { codigo: "asc" } }),
    empleadosLiquidables(db),
  ])

  const periodosAbiertos = periodos.filter((p) => p.estado === "ABIERTO").map((p) => ({ id: p.id, codigo: p.codigo }))
  const periodosLiquidados = periodos.filter((p) => p.estado === "LIQUIDADO").map((p) => ({ id: p.id, codigo: p.codigo }))
  const totalNominaMesActual = liquidaciones
    .filter((l) => l.periodo.codigo === periodos[0]?.codigo)
    .reduce((s, l) => s + Number(l.netoPagar), 0)

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Nómina</h1>
        <p className="text-sm text-slate-500">
          {empleados.length} funcionario(s) con salario asignado · {periodos.length} periodo(s) · {conceptos.length} concepto(s) sembrados.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{empleados.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Liquidables</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{periodos[0]?.codigo ?? "—"}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Último periodo</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{money(totalNominaMesActual)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Neto último periodo</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{conceptos.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Conceptos</div>
        </div>
      </div>

      <NominaAcciones
        puedeLiquidar={puedeLiquidar}
        puedePagar={puedePagar}
        hayConceptos={conceptos.length > 0}
        periodosAbiertos={periodosAbiertos}
        periodosLiquidados={periodosLiquidados}
        cuentasBanco={cuentas.map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.nombre}` }))}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Periodos</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Liquidado</th>
                <th className="px-4 py-3">Pagado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periodos.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aún no hay periodos.</td></tr>
              )}
              {periodos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.codigo}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[p.estado] ?? "bg-slate-100 text-slate-700"}`}>{p.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.liquidadoEn ? p.liquidadoEn.toISOString().slice(0, 10) : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{p.pagadoEn ? p.pagadoEn.toISOString().slice(0, 10) : "—"}</td>
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
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Funcionario</th>
                <th className="px-4 py-3">Devengado</th>
                <th className="px-4 py-3">Deducciones</th>
                <th className="px-4 py-3">Aportes patronales</th>
                <th className="px-4 py-3">Neto a pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liquidaciones.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aún no hay liquidaciones.</td></tr>
              )}
              {liquidaciones.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{l.periodo.codigo}</td>
                  <td className="px-4 py-3 text-slate-800">{l.usuario.nombre} {l.usuario.apellido}</td>
                  <td className="px-4 py-3 text-slate-600">{money(l.totalDevengado)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(l.totalDeducciones)}</td>
                  <td className="px-4 py-3 text-slate-600">{money(l.totalAportesPatronales)}</td>
                  <td className="px-4 py-3 font-medium text-emerald-700">{money(l.netoPagar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { ContabilidadAcciones } from "./contabilidad-acciones"

export const dynamic = "force-dynamic"

const ESTADO_PERIODO_COLOR: Record<string, string> = {
  ABIERTO: "bg-emerald-100 text-emerald-800",
  AJUSTE: "bg-amber-100 text-amber-800",
  CERRADO: "bg-slate-200 text-slate-700",
}

export default async function ContabilidadPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeAdministrar, puedeRegistrar] = await Promise.all([
    funcionarioPuede(ctx, "contabilidad", "administrar"),
    funcionarioPuede(ctx, "contabilidad", "registrar"),
  ])

  const [cuentas, periodos, terceros, comprobantes] = await Promise.all([
    db.planCuenta.findMany({ orderBy: { codigo: "asc" } }),
    db.periodoContable.findMany({ orderBy: { codigo: "desc" } }),
    db.tercero.findMany({ orderBy: { razonSocial: "asc" } }),
    db.comprobante.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { periodo: true, asientos: { include: { cuenta: true, tercero: true } } },
    }),
  ])

  const cuentasHoja = cuentas.filter((c) => c.permiteMovimientos && c.activa)
  const sinAcceso = !puedeAdministrar && !puedeRegistrar

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Contabilidad</h1>
        <p className="text-sm text-slate-500">
          {cuentas.length} cuenta(s) del CGC · {periodos.length} periodo(s) · {comprobantes.length} comprobante(s) recientes.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{cuentas.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Cuentas CGC</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{periodos.filter((p) => p.estado === "ABIERTO").length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Periodos abiertos</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{terceros.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Terceros</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{comprobantes.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Comprobantes</div>
        </div>
      </div>

      {sinAcceso && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Contabilidad. Pídele a un administrador que te asigne un cargo con
          <span className="font-mono"> contabilidad</span> (registrar / administrar).
        </div>
      )}

      <ContabilidadAcciones
        puedeAdministrar={puedeAdministrar}
        puedeRegistrar={puedeRegistrar}
        planCuentasVacio={cuentas.length === 0}
        cuentas={cuentasHoja.map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.nombre}`, naturaleza: c.naturaleza }))}
        periodos={periodos
          .filter((p) => p.estado !== "CERRADO")
          .map((p) => ({ id: p.id, etiqueta: `${p.codigo} (${p.estado})` }))}
        terceros={terceros.map((t) => ({ id: t.id, etiqueta: `${t.documento} · ${t.razonSocial}` }))}
      />

      {/* Periodos */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Periodos contables</h2>
        {periodos.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay periodos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {periodos.map((p) => (
              <span
                key={p.id}
                className={`rounded-full px-3 py-1 text-xs font-medium ${ESTADO_PERIODO_COLOR[p.estado] ?? "bg-slate-100 text-slate-700"}`}
              >
                {p.codigo} · {p.estado}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Plan de cuentas */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Plan de cuentas (CGC)</h2>
        {cuentas.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
            Aún no hay plan de cuentas sembrado.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {cuentas.map((c) => (
                  <tr key={c.id} className={c.permiteMovimientos ? "" : "bg-slate-50/60"}>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500" style={{ paddingLeft: `${1 + (c.nivel - 1) * 1.25}rem` }}>
                      {c.codigo}
                    </td>
                    <td className={`px-4 py-2 ${c.permiteMovimientos ? "text-slate-800" : "font-medium text-slate-600"}`}>{c.nombre}</td>
                    <td className="px-4 py-2 text-right text-xs text-slate-400">{c.naturaleza}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Comprobantes */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Comprobantes recientes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3 text-right">Débito</th>
                <th className="px-4 py-3 text-right">Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comprobantes.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aún no hay comprobantes.</td></tr>
              )}
              {comprobantes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{c.tipo}</td>
                  <td className="px-4 py-3 text-slate-500">{c.fecha.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-800">{c.descripcion}</td>
                  <td className="px-4 py-3 text-slate-500">{c.periodo.codigo}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">${Number(c.totalDebito).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">${Number(c.totalCredito).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

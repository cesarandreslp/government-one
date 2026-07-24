import Link from "next/link"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { saldoCuentaContable, movimientosDeCuenta } from "@/lib/tesoreria/movimientos"
import { TesoreriaAcciones } from "./tesoreria-acciones"

export const dynamic = "force-dynamic"

function money(n: unknown): string {
  return `$${Number(n).toLocaleString("es-CO")}`
}

export default async function TesoreriaPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar, puedeConciliar] = await Promise.all([
    funcionarioPuede(ctx, "tesoreria", "consultar"),
    funcionarioPuede(ctx, "tesoreria", "administrar"),
    funcionarioPuede(ctx, "tesoreria", "conciliar"),
  ])
  const sinAcceso = !puedeConsultar && !puedeAdministrar && !puedeConciliar

  if (sinAcceso) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Tesorería</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Tesorería. Pídele a un administrador un cargo con{" "}
          <span className="font-mono">tesoreria</span> (consultar / administrar / conciliar).
        </p>
      </main>
    )
  }

  const [cuentas, cuentasContables, extractos] = await Promise.all([
    db.tesoCuenta.findMany({ where: { activa: true }, include: { cuentaContable: true }, orderBy: { nombre: "asc" } }),
    db.planCuenta.findMany({ where: { permiteMovimientos: true, activa: true }, orderBy: { codigo: "asc" } }),
    db.tesoExtracto.findMany({ orderBy: { periodo: "desc" }, take: 20, include: { cuenta: true, lineas: { select: { id: true, conciliacionLinea: true } } } }),
  ])

  const saldos = await Promise.all(cuentas.map((c) => saldoCuentaContable(db, c.cuentaContableId)))
  const movimientosPorCuenta = await Promise.all(cuentas.map((c) => movimientosDeCuenta(db, c.cuentaContableId)))
  const saldoTotal = saldos.reduce((s, v) => s + v, 0)
  const pendientesTotal = movimientosPorCuenta.reduce((s, movs) => s + movs.filter((m) => !m.conciliado).length, 0)
  const movimientosRecientes = movimientosPorCuenta.flatMap((movs, i) => movs.map((m) => ({ ...m, cuenta: cuentas[i].nombre }))).sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 15)

  const cuentasContablesBanco = cuentasContables.filter((c) => c.codigo.startsWith("11"))

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Tesorería</h1>
        <p className="text-sm text-slate-500">
          {cuentas.length} cuenta(s) bancaria(s) · saldo derivado siempre del libro mayor, cero duplicación.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{cuentas.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Cuentas</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{money(saldoTotal)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Saldo total</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{pendientesTotal}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Sin conciliar</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{extractos.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Extractos cargados</div>
        </div>
      </div>

      <TesoreriaAcciones
        puedeAdministrar={puedeAdministrar}
        puedeConciliar={puedeConciliar}
        cuentasContablesBanco={cuentasContablesBanco.map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.nombre}` }))}
        cuentasContablesTodas={cuentasContables.map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.nombre}` }))}
        cuentasTesoreria={cuentas.map((c) => ({ id: c.id, etiqueta: `${c.nombre} — ${c.banco} ${c.numeroCuenta}` }))}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Cuentas bancarias</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3">Banco</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cuenta contable</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Sin conciliar</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cuentas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aún no hay cuentas bancarias.</td></tr>
              )}
              {cuentas.map((c, i) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-500">{c.banco}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.numeroCuenta}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.cuentaContable.codigo} · {c.cuentaContable.nombre}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{money(saldos[i])}</td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">{movimientosPorCuenta[i].filter((m) => !m.conciliado).length}</td>
                  <td className="px-4 py-3 text-right">
                    {puedeConciliar && (
                      <Link href={`/admin/tesoreria/conciliar?cuentaId=${c.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                        Conciliar →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Movimientos recientes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3">Comprobante</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Débito</th>
                <th className="px-4 py-3 text-right">Crédito</th>
                <th className="px-4 py-3">Conciliado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientosRecientes.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Aún no hay movimientos.</td></tr>
              )}
              {movimientosRecientes.map((m) => (
                <tr key={m.asientoId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{m.fecha.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-700">{m.cuenta}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.numero}</td>
                  <td className="px-4 py-3 text-slate-500">{m.fuenteModulo ?? "manual"}</td>
                  <td className="px-4 py-3 text-slate-800">{m.descripcion}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{Number(m.debito) > 0 ? money(m.debito) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{Number(m.credito) > 0 ? money(m.credito) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.conciliado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {m.conciliado ? "Sí" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Extractos cargados</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3 text-right">Saldo inicial</th>
                <th className="px-4 py-3 text-right">Saldo final</th>
                <th className="px-4 py-3 text-right">Líneas</th>
                <th className="px-4 py-3 text-right">Sin conciliar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {extractos.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aún no hay extractos cargados.</td></tr>
              )}
              {extractos.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{e.cuenta.nombre}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.periodo}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{money(e.saldoInicial)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{money(e.saldoFinal)}</td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">{e.lineas.length}</td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">{e.lineas.filter((l) => !l.conciliacionLinea).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

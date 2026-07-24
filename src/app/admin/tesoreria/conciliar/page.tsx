import Link from "next/link"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { movimientosPendientes } from "@/lib/tesoreria/movimientos"
import { ConciliarPanel } from "./conciliar-panel"

export const dynamic = "force-dynamic"

export default async function ConciliarPage({
  searchParams,
}: {
  searchParams: Promise<{ cuentaId?: string; periodo?: string }>
}) {
  const { cuentaId, periodo } = await searchParams
  const ctx = await requerirFuncionario()
  const { db } = ctx

  if (!(await funcionarioPuede(ctx, "tesoreria", "conciliar"))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">tesoreria:conciliar</span>.
        </p>
      </main>
    )
  }

  const cuentas = await db.tesoCuenta.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } })

  if (!cuentaId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-semibold text-slate-800">Conciliación bancaria</h1>
        {cuentas.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay cuentas bancarias.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
            {cuentas.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/tesoreria/conciliar?cuentaId=${c.id}`} className="block px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                  {c.nombre} — {c.banco} {c.numeroCuenta}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    )
  }

  const cuenta = await db.tesoCuenta.findUnique({ where: { id: cuentaId }, include: { cuentaContable: true } })
  if (!cuenta) {
    return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-red-600">Cuenta no encontrada.</p></main>
  }

  const extractos = await db.tesoExtracto.findMany({ where: { cuentaId }, orderBy: { periodo: "desc" } })
  const periodoSeleccionado = periodo ?? extractos[0]?.periodo
  const extracto = extractos.find((e) => e.periodo === periodoSeleccionado)

  const [lineasPendientesRaw, asientosPendientesRaw, conciliadosRaw] = await Promise.all([
    extracto ? db.tesoExtractoLinea.findMany({ where: { extractoId: extracto.id, conciliacionLinea: null }, orderBy: { fecha: "asc" } }) : Promise.resolve([]),
    movimientosPendientes(db, cuenta.cuentaContableId),
    db.tesoConciliacion.findMany({ where: { cuentaId }, include: { asiento: { include: { comprobante: true } }, lineas: { include: { extractoLinea: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ])

  const asientosPendientes = asientosPendientesRaw.map((m) => ({
    asientoId: m.asientoId,
    fecha: m.fecha.toISOString().slice(0, 10),
    numero: m.numero,
    descripcion: m.descripcion,
    valor: m.debito > 0 ? m.debito : m.credito,
  }))
  const lineasPendientes = lineasPendientesRaw.map((l) => ({
    id: l.id,
    fecha: l.fecha.toISOString().slice(0, 10),
    descripcion: l.descripcion,
    referencia: l.referencia,
    valor: Number(l.debito ?? 0) || Number(l.credito ?? 0),
  }))
  const conciliados = conciliadosRaw.map((c) => ({
    asientoId: c.asientoId,
    numero: c.asiento.comprobante.numero,
    descripcion: c.asiento.descripcion ?? c.asiento.comprobante.descripcion,
    valor: Number(c.asiento.debito) > 0 ? Number(c.asiento.debito) : Number(c.asiento.credito),
    lineas: c.lineas.map((l) => l.extractoLinea.descripcion),
  }))

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Conciliación — {cuenta.nombre}</h1>
        <p className="text-sm text-slate-500">{cuenta.banco} {cuenta.numeroCuenta} · {cuenta.cuentaContable.codigo} {cuenta.cuentaContable.nombre}</p>
      </header>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="cuentaId" value={cuentaId} />
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Cuenta</span>
          <select
            name="cuentaId"
            defaultValue={cuentaId}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          >
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Periodo del extracto</span>
          <select name="periodo" defaultValue={periodoSeleccionado ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900">
            {extractos.length === 0 && <option value="">— Sin extractos —</option>}
            {extractos.map((e) => (
              <option key={e.id} value={e.periodo}>{e.periodo}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Ver</button>
      </form>

      {!extracto && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Esta cuenta aún no tiene extractos cargados. Cárgalo desde Tesorería para poder conciliar por línea.
        </p>
      )}

      <ConciliarPanel cuentaId={cuentaId} asientosPendientes={asientosPendientes} lineasPendientes={lineasPendientes} conciliados={conciliados} />
    </main>
  )
}

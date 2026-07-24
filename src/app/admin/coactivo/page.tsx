import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { CoactivoAcciones } from "./coactivo-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  PERSUASIVO: "bg-slate-100 text-slate-700",
  MANDAMIENTO_PAGO: "bg-amber-100 text-amber-800",
  EMBARGO: "bg-red-100 text-red-800",
  ACUERDO_PAGO: "bg-blue-100 text-blue-700",
  TERMINADO: "bg-emerald-100 text-emerald-800",
}

function money(n: unknown): string {
  return `$${Number(n).toLocaleString("es-CO")}`
}

export default async function CoactivoPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeGestionar, puedeRecaudar] = await Promise.all([
    funcionarioPuede(ctx, "cobro_coactivo", "consultar"),
    funcionarioPuede(ctx, "cobro_coactivo", "gestionar"),
    funcionarioPuede(ctx, "cobro_coactivo", "recaudar"),
  ])
  const sinAcceso = !puedeConsultar && !puedeGestionar && !puedeRecaudar

  if (sinAcceso) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Cobro Coactivo</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Cobro Coactivo. Pídele a un administrador un cargo con{" "}
          <span className="font-mono">cobro_coactivo</span> (consultar / gestionar / recaudar).
        </p>
      </main>
    )
  }

  const [procesos, terceros, cuentasBanco] = await Promise.all([
    db.coactivoProceso.findMany({
      orderBy: { createdAt: "desc" },
      include: { contribuyente: true, liquidaciones: true, actuaciones: { orderBy: { createdAt: "desc" } }, acuerdoPago: { include: { cuotas: { orderBy: { numero: "asc" } } } } },
    }),
    db.tercero.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    db.planCuenta.findMany({ where: { permiteMovimientos: true, activa: true, codigo: { startsWith: "11" } }, orderBy: { codigo: "asc" } }),
  ])

  const saldoProceso = (p: (typeof procesos)[number]) => {
    if (p.estado === "TERMINADO") return 0
    if (!p.acuerdoPago) return Number(p.valorInicial)
    const pagado = p.acuerdoPago.cuotas.filter((c) => c.estado === "PAGADA").reduce((s, c) => s + Number(c.valor), 0)
    return Number(p.valorInicial) - pagado
  }

  const abiertos = procesos.filter((p) => p.estado !== "TERMINADO")
  const carteraCoactiva = abiertos.reduce((s, p) => s + saldoProceso(p), 0)
  const recaudadoCoactivo = procesos.reduce((s, p) => s + (Number(p.valorInicial) - saldoProceso(p)), 0)

  const procesosSinAcuerdo = abiertos.filter((p) => !p.acuerdoPago)
  const procesosConAcuerdo = abiertos.filter((p) => p.acuerdoPago)
  const cuotasPendientes = procesosConAcuerdo.flatMap((p) =>
    (p.acuerdoPago?.cuotas ?? [])
      .filter((c) => c.estado === "PENDIENTE")
      .map((c) => ({ id: c.id, etiqueta: `${p.numero} · cuota ${c.numero}/${p.acuerdoPago!.numeroCuotas} — ${money(c.valor)}` })),
  )

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Cobro Coactivo</h1>
        <p className="text-sm text-slate-500">{procesos.length} proceso(s) · cartera vencida de Rentas agrupada por contribuyente.</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{abiertos.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Procesos abiertos</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{money(carteraCoactiva)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Cartera en coactivo</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-emerald-700">{money(recaudadoCoactivo)}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Recaudado vía coactivo</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{procesosConAcuerdo.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Con acuerdo de pago</div>
        </div>
      </div>

      <CoactivoAcciones
        puedeGestionar={puedeGestionar}
        puedeRecaudar={puedeRecaudar}
        terceros={terceros.map((t) => ({ id: t.id, etiqueta: `${t.documento} · ${t.razonSocial}` }))}
        cuentasBanco={cuentasBanco.map((c) => ({ id: c.id, etiqueta: `${c.codigo} · ${c.nombre}` }))}
        procesosAbiertos={abiertos.map((p) => ({ id: p.id, etiqueta: `${p.numero} · ${p.contribuyente.razonSocial} — ${money(saldoProceso(p))}` }))}
        procesosSinAcuerdo={procesosSinAcuerdo.map((p) => ({ id: p.id, etiqueta: `${p.numero} · ${p.contribuyente.razonSocial} — ${money(saldoProceso(p))}` }))}
        cuotasPendientes={cuotasPendientes}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Procesos</h2>
        <div className="grid gap-3">
          {procesos.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay procesos de cobro coactivo.</p>
          )}
          {procesos.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-sm text-slate-700">{p.numero}</span>{" "}
                  <span className="text-sm text-slate-800">{p.contribuyente.razonSocial}</span>{" "}
                  <span className="text-xs text-slate-400">({p.tipo} · vigencia {p.vigencia})</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[p.estado] ?? "bg-slate-100 text-slate-700"}`}>{p.estado}</span>
              </div>
              <div className="mt-2 flex gap-6 text-sm">
                <div><span className="text-slate-500">Deuda inicial:</span> <span className="font-mono text-slate-700">{money(p.valorInicial)}</span></div>
                <div><span className="text-slate-500">Saldo pendiente:</span> <span className="font-mono font-medium text-slate-800">{money(saldoProceso(p))}</span></div>
                <div><span className="text-slate-500">Liquidaciones:</span> <span className="text-slate-700">{p.liquidaciones.length}</span></div>
              </div>
              {p.acuerdoPago && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
                  <span className="font-medium text-slate-600">Cuotas: </span>
                  {p.acuerdoPago.cuotas.map((c) => (
                    <span key={c.id} className={`mr-2 rounded px-1.5 py-0.5 ${c.estado === "PAGADA" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      #{c.numero} {money(c.valor)} {c.estado === "PAGADA" ? "✓" : ""}
                    </span>
                  ))}
                </div>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-500">Historial de actuaciones ({p.actuaciones.length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {p.actuaciones.map((a) => (
                    <li key={a.id}>
                      <span className="font-mono text-slate-400">{a.fecha.toISOString().slice(0, 10)}</span>{" "}
                      <span className="font-medium">{a.tipo}</span> — {a.descripcion}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

export const dynamic = "force-dynamic"

const NIVEL_ORDEN = ["DIRECTIVO", "ASESOR", "PROFESIONAL", "TECNICO", "ASISTENCIAL"] as const
const NIVEL_LABEL: Record<string, string> = { DIRECTIVO: "Directivo", ASESOR: "Asesor", PROFESIONAL: "Profesional", TECNICO: "Técnico", ASISTENCIAL: "Asistencial" }

export default async function PlaneacionTHPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  if (!(await funcionarioPuede(ctx, "gestion_humana", "consultar"))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidad de Talento Humano para consultar la planeación de planta.
        </p>
      </main>
    )
  }

  const cargos = await db.cargo.findMany({
    where: { activo: true },
    include: { dependencia: true, vinculaciones: true, empleo: true },
    orderBy: [{ dependencia: { codigo: "asc" } }, { nombre: "asc" }],
  })

  const hoy = new Date()
  const vigente = (v: { desde: Date; hasta: Date | null }) => v.desde <= hoy && (v.hasta === null || v.hasta >= hoy)
  const conOcupante = cargos.filter((c) => c.vinculaciones.some(vigente))
  const vacantes = cargos.filter((c) => !c.vinculaciones.some(vigente))

  const porNivel = new Map<string, { total: number; vacantes: number }>()
  for (const c of cargos) {
    const nivel = c.nivel ?? "SIN_CLASIFICAR"
    const actual = porNivel.get(nivel) ?? { total: 0, vacantes: 0 }
    actual.total += 1
    if (!c.vinculaciones.some(vigente)) actual.vacantes += 1
    porNivel.set(nivel, actual)
  }

  const porDependencia = new Map<string, { nombre: string; total: number; vacantes: number }>()
  for (const c of cargos) {
    const actual = porDependencia.get(c.dependencia.codigo) ?? { nombre: c.dependencia.nombre, total: 0, vacantes: 0 }
    actual.total += 1
    if (!c.vinculaciones.some(vigente)) actual.vacantes += 1
    porDependencia.set(c.dependencia.codigo, actual)
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Planeación del Talento Humano</h1>
        <p className="text-sm text-slate-500">Dimensionamiento de planta y Plan Anual de Vacantes — derivado de la estructura y vinculaciones vigentes.</p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{cargos.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Planta total</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-emerald-700">{conOcupante.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Con ocupante</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-amber-700">{vacantes.length}</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Vacantes</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold text-slate-800">{cargos.length > 0 ? Math.round((vacantes.length / cargos.length) * 100) : 0}%</div>
          <div className="text-xs uppercase tracking-wide text-slate-400">% de vacancia</div>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dimensionamiento por nivel</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Nivel</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Vacantes</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {NIVEL_ORDEN.filter((n) => porNivel.has(n)).map((n) => (
                <tr key={n} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{NIVEL_LABEL[n]}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{porNivel.get(n)!.total}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{porNivel.get(n)!.vacantes}</td>
                </tr>
              ))}
              {porNivel.has("SIN_CLASIFICAR") && (
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">Sin clasificar (elección/período fijo)</td>
                  <td className="px-4 py-3 text-right text-slate-600">{porNivel.get("SIN_CLASIFICAR")!.total}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{porNivel.get("SIN_CLASIFICAR")!.vacantes}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dimensionamiento por dependencia</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Dependencia</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Vacantes</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...porDependencia.entries()].map(([codigo, d]) => (
                <tr key={codigo} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{codigo} · {d.nombre}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{d.total}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{d.vacantes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Plan Anual de Vacantes ({vacantes.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Dependencia</th><th className="px-4 py-3">Cargo</th><th className="px-4 py-3">Denominación DAFP</th><th className="px-4 py-3">Nivel</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vacantes.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No hay cargos vacantes — planta completa.</td></tr>}
              {vacantes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{c.dependencia.codigo}</td>
                  <td className="px-4 py-3 text-slate-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-500">{c.empleo?.denominacion ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.nivel ? NIVEL_LABEL[c.nivel] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

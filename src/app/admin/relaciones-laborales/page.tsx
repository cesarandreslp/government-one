import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { RelLabAcciones } from "./rellab-acciones"

export const dynamic = "force-dynamic"

export default async function RelacionesLaboralesPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "relaciones_laborales", "consultar"),
    funcionarioPuede(ctx, "relaciones_laborales", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Relaciones Laborales</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">relaciones_laborales</span>.
        </p>
      </main>
    )
  }

  const [permisos, usuarios] = await Promise.all([
    db.permisoSindical.findMany({ orderBy: { fechaInicio: "desc" }, include: { usuario: true } }),
    db.usuario.findMany({ where: { activo: true }, orderBy: { apellido: "asc" } }),
  ])

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Relaciones Laborales</h1>
        <p className="text-sm text-slate-500">Permisos sindicales — {permisos.length} registrado(s).</p>
      </header>

      <RelLabAcciones puedeAdministrar={puedeAdministrar} usuarios={usuarios.map((u) => ({ id: u.id, etiqueta: `${u.nombre} ${u.apellido}` }))} />

      <section className="mt-8">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Funcionario</th><th className="px-4 py-3">Desde</th><th className="px-4 py-3">Hasta</th><th className="px-4 py-3">Motivo</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permisos.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aún no hay permisos sindicales registrados.</td></tr>}
              {permisos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{p.usuario.nombre} {p.usuario.apellido}</td>
                  <td className="px-4 py-3 text-slate-500">{p.fechaInicio.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-500">{p.fechaFin.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

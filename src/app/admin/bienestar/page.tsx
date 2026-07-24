import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { BienestarAcciones } from "./bienestar-acciones"

export const dynamic = "force-dynamic"

export default async function BienestarPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "bienestar", "consultar"),
    funcionarioPuede(ctx, "bienestar", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Bienestar Social</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">bienestar</span>.
        </p>
      </main>
    )
  }

  const [actividades, usuarios] = await Promise.all([
    db.actividadBienestar.findMany({ orderBy: { fecha: "desc" }, include: { participantes: { include: { usuario: true } } } }),
    db.usuario.findMany({ where: { activo: true }, orderBy: { apellido: "asc" } }),
  ])

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Bienestar Social</h1>
        <p className="text-sm text-slate-500">{actividades.length} actividad(es) registradas.</p>
      </header>

      <BienestarAcciones
        puedeAdministrar={puedeAdministrar}
        usuarios={usuarios.map((u) => ({ id: u.id, etiqueta: `${u.nombre} ${u.apellido}` }))}
        actividades={actividades.map((a) => ({ id: a.id, etiqueta: `${a.nombre} (${a.tipo})` }))}
      />

      <section className="mt-8 grid gap-3">
        {actividades.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay actividades registradas.</p>
        )}
        {actividades.map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-semibold text-slate-800">{a.nombre}</span>{" "}
                <span className="text-xs text-slate-400">({a.tipo})</span>
              </div>
              <span className="text-xs text-slate-500">{a.fecha.toISOString().slice(0, 10)}</span>
            </div>
            {a.descripcion && <p className="mt-1 text-xs text-slate-500">{a.descripcion}</p>}
            <div className="mt-3 text-xs">
              {a.participantes.length === 0 ? (
                <span className="text-slate-400">Sin participantes.</span>
              ) : (
                a.participantes.map((p) => (
                  <span key={p.id} className="mr-2 mb-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                    {p.usuario.nombre} {p.usuario.apellido}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

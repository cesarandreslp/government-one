import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { VictimasAcciones } from "./victimas-acciones"

export const dynamic = "force-dynamic"

export default async function EnlaceVictimasPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "enlace_victimas", "consultar"),
    funcionarioPuede(ctx, "enlace_victimas", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Enlace de Víctimas</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">enlace_victimas</span>.
        </p>
      </main>
    )
  }

  const [entregas, personas] = await Promise.all([
    ctx.db.ahiEntrega.findMany({ orderBy: { fechaEntrega: "desc" }, include: { persona: true } }),
    ctx.db.tercero.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ])

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Enlace de Víctimas</h1>
        <p className="text-sm text-slate-500">{entregas.length} Ayuda(s) Humanitaria(s) Inmediata(s) entregada(s).</p>
        <p className="mt-1 text-xs text-slate-400">
          El Registro Único de Víctimas (RUV) es nacional (Unidad para las Víctimas) — esto es la Ayuda
          Humanitaria Inmediata que la entidad territorial entrega ante un hecho victimizante reciente
          (Ley 1448/2011).
        </p>
      </header>

      <VictimasAcciones
        puedeAdministrar={puedeAdministrar}
        personas={personas.map((p) => ({ id: p.id, etiqueta: `${p.razonSocial} (${p.documento})` }))}
      />

      <section className="mt-8 grid gap-3">
        {entregas.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay ayudas registradas.</p>
        )}
        {entregas.map((e) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-slate-800">{e.persona.razonSocial}</span>
                <span className="ml-2 text-xs text-slate-400">{e.persona.documento}</span>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{e.hechoVictimizante.replaceAll("_", " ")}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Hecho {e.fechaHecho.toISOString().slice(0, 10)} · Entrega {e.fechaEntrega.toISOString().slice(0, 10)} · {e.tipoAyuda}
              {e.descripcion && ` · ${e.descripcion}`}
            </p>
          </div>
        ))}
      </section>
    </main>
  )
}

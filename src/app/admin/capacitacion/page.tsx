import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { CapacitacionAcciones } from "./capacitacion-acciones"

export const dynamic = "force-dynamic"

export default async function CapacitacionPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "capacitacion", "consultar"),
    funcionarioPuede(ctx, "capacitacion", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Capacitación</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">capacitacion</span>.
        </p>
      </main>
    )
  }

  const [capacitaciones, usuarios] = await Promise.all([
    db.capacitacion.findMany({ orderBy: { fechaInicio: "desc" }, include: { inscripciones: { include: { usuario: true } } } }),
    db.usuario.findMany({ where: { activo: true }, orderBy: { apellido: "asc" } }),
  ])

  const inscripcionesPendientes = capacitaciones.flatMap((c) =>
    c.inscripciones.filter((i) => !i.asistio).map((i) => ({ id: i.id, etiqueta: `${c.nombre} — ${i.usuario.nombre} ${i.usuario.apellido}` })),
  )

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Capacitación</h1>
        <p className="text-sm text-slate-500">Plan Institucional de Capacitación (PIC) — {capacitaciones.length} actividad(es) registradas.</p>
      </header>

      <CapacitacionAcciones
        puedeAdministrar={puedeAdministrar}
        usuarios={usuarios.map((u) => ({ id: u.id, etiqueta: `${u.nombre} ${u.apellido}` }))}
        capacitaciones={capacitaciones.map((c) => ({ id: c.id, etiqueta: `${c.nombre} (${c.tipo})` }))}
        inscripcionesPendientes={inscripcionesPendientes}
      />

      <section className="mt-8 grid gap-3">
        {capacitaciones.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay capacitaciones registradas.</p>
        )}
        {capacitaciones.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-semibold text-slate-800">{c.nombre}</span>{" "}
                <span className="text-xs text-slate-400">({c.tipo}{c.horas ? ` · ${c.horas}h` : ""}{c.entidadCapacitadora ? ` · ${c.entidadCapacitadora}` : ""})</span>
              </div>
              <span className="text-xs text-slate-500">{c.fechaInicio.toISOString().slice(0, 10)} → {c.fechaFin.toISOString().slice(0, 10)}</span>
            </div>
            <div className="mt-3 text-xs">
              {c.inscripciones.length === 0 ? (
                <span className="text-slate-400">Sin inscritos.</span>
              ) : (
                c.inscripciones.map((i) => (
                  <span key={i.id} className={`mr-2 mb-1 inline-block rounded px-1.5 py-0.5 ${i.asistio ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {i.usuario.nombre} {i.usuario.apellido} {i.asistio ? "✓ asistió" : "· pendiente"}
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

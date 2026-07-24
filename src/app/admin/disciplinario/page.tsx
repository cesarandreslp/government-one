import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { DisciplinarioAcciones } from "./disciplinario-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  INDAGACION_PRELIMINAR: "bg-slate-100 text-slate-700",
  INVESTIGACION: "bg-amber-100 text-amber-800",
  DESCARGOS: "bg-blue-100 text-blue-700",
  FALLO: "bg-red-100 text-red-800",
  ARCHIVADO: "bg-emerald-100 text-emerald-800",
}

export default async function DisciplinarioPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeGestionar] = await Promise.all([
    funcionarioPuede(ctx, "gestion_disciplinaria", "consultar"),
    funcionarioPuede(ctx, "gestion_disciplinaria", "gestionar"),
  ])
  if (!puedeConsultar && !puedeGestionar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Gestión Disciplinaria</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">gestion_disciplinaria</span>.
        </p>
      </main>
    )
  }

  const [procesos, usuarios] = await Promise.all([
    db.procesoDisciplinario.findMany({ orderBy: { createdAt: "desc" }, include: { usuario: true, actuaciones: { orderBy: { createdAt: "desc" } } } }),
    db.usuario.findMany({ where: { activo: true }, orderBy: { apellido: "asc" } }),
  ])

  const procesosAbiertos = procesos.filter((p) => p.estado !== "ARCHIVADO")

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Gestión Disciplinaria</h1>
        <p className="text-sm text-slate-500">{procesos.length} proceso(s) · {procesosAbiertos.length} abierto(s).</p>
        <p className="mt-1 text-xs text-slate-400">Registro administrativo interno (Ley 1952/2019) — no reemplaza notificación judicial con efectos procesales.</p>
      </header>

      <DisciplinarioAcciones
        puedeGestionar={puedeGestionar}
        usuarios={usuarios.map((u) => ({ id: u.id, etiqueta: `${u.nombre} ${u.apellido}` }))}
        procesosAbiertos={procesosAbiertos.map((p) => ({ id: p.id, etiqueta: `${p.numero} · ${p.usuario.nombre} ${p.usuario.apellido} (${p.estado})` }))}
      />

      <section className="mt-8 grid gap-3">
        {procesos.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay procesos disciplinarios.</p>
        )}
        {procesos.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-sm text-slate-700">{p.numero}</span>{" "}
                <span className="text-sm text-slate-800">{p.usuario.nombre} {p.usuario.apellido}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[p.estado]}`}>{p.estado}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{p.motivo}</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-slate-500">Historial de actuaciones ({p.actuaciones.length})</summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {p.actuaciones.map((a) => (
                  <li key={a.id}><span className="font-mono text-slate-400">{a.fecha.toISOString().slice(0, 10)}</span> — {a.descripcion}</li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </section>
    </main>
  )
}

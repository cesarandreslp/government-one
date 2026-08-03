import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { ConvivenciaAcciones } from "./convivencia-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  CUMPLIDO: "bg-emerald-100 text-emerald-800",
}

export default async function ConvivenciaSeguridadPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "convivencia_seguridad", "consultar"),
    funcionarioPuede(ctx, "convivencia_seguridad", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Convivencia y Seguridad Ciudadana</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">convivencia_seguridad</span>.
        </p>
      </main>
    )
  }

  const sesiones = await db.sesionConsejoSeguridad.findMany({
    orderBy: { fecha: "desc" },
    include: { acuerdos: { orderBy: { createdAt: "asc" } } },
  })
  const acuerdosPendientes = sesiones.flatMap((s) => s.acuerdos.filter((a) => a.estado === "PENDIENTE").map((a) => ({ ...a, sesionTema: s.tema })))

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Convivencia y Seguridad Ciudadana</h1>
        <p className="text-sm text-slate-500">{sesiones.length} sesión(es) · {acuerdosPendientes.length} acuerdo(s) pendiente(s).</p>
        <p className="mt-1 text-xs text-slate-400">
          Sesiones del Consejo de Seguridad y seguimiento a sus acuerdos — articulación con la Fuerza Pública
          y el Plan Integral de Seguridad y Convivencia Ciudadana (PISCC).
        </p>
      </header>

      <ConvivenciaAcciones
        puedeAdministrar={puedeAdministrar}
        sesiones={sesiones.map((s) => ({ id: s.id, etiqueta: `${s.fecha.toISOString().slice(0, 10)} · ${s.tema}` }))}
        acuerdosPendientes={acuerdosPendientes.map((a) => ({ id: a.id, etiqueta: `${a.sesionTema}: ${a.descripcion} (${a.responsable})` }))}
      />

      <section className="mt-8 grid gap-3">
        {sesiones.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay sesiones registradas.</p>
        )}
        {sesiones.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-slate-800">{s.tema}</span>
                <span className="ml-2 text-xs text-slate-400">{s.fecha.toISOString().slice(0, 10)}</span>
              </div>
            </div>
            {s.resumen && <p className="mt-1 text-xs text-slate-500">{s.resumen}</p>}
            {s.acuerdos.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                {s.acuerdos.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600">{a.descripcion} — <span className="text-slate-400">{a.responsable}</span></span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${ESTADO_COLOR[a.estado]}`}>{a.estado}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </main>
  )
}

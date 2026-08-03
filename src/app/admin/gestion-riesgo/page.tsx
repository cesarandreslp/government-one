import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { GestionRiesgoAcciones } from "./gestion-riesgo-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  ATENCION: "bg-amber-100 text-amber-800",
  CERRADA: "bg-slate-200 text-slate-500",
}

export default async function GestionRiesgoPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "gestion_riesgo", "consultar"),
    funcionarioPuede(ctx, "gestion_riesgo", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Gestión del Riesgo de Desastres</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">gestion_riesgo</span>.
        </p>
      </main>
    )
  }

  const emergencias = await db.emergenciaGrd.findMany({
    orderBy: { fecha: "desc" },
    include: { ayudas: { orderBy: { fechaEntrega: "desc" } } },
  })
  const enAtencion = emergencias.filter((e) => e.estado === "ATENCION")

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Gestión del Riesgo de Desastres</h1>
        <p className="text-sm text-slate-500">{emergencias.length} emergencia(s) · {enAtencion.length} en atención.</p>
        <p className="mt-1 text-xs text-slate-400">
          CMGRD (Ley 1523/2012) — registro agregado de emergencias atendidas y ayudas entregadas, para
          trazabilidad ante entes de control. Cifras de afectación, no un registro nominal de damnificados.
        </p>
      </header>

      <GestionRiesgoAcciones
        puedeAdministrar={puedeAdministrar}
        emergenciasAbiertas={enAtencion.map((e) => ({ id: e.id, etiqueta: `${e.numero} · ${e.ubicacion}` }))}
      />

      <section className="mt-8 grid gap-3">
        {emergencias.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay emergencias registradas.</p>
        )}
        {emergencias.map((e) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs text-slate-500">{e.numero}</span>
                <span className="ml-2 font-medium text-slate-800">{e.tipoEvento.replaceAll("_", " ")}</span>
                <span className="ml-2 text-xs text-slate-400">{e.ubicacion} · {e.fecha.toISOString().slice(0, 10)}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[e.estado]}`}>{e.estado}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {e.familiasAfectadas} familia(s) · {e.personasAfectadas} persona(s) afectadas
              {e.descripcion && ` · ${e.descripcion}`}
            </p>
            {e.ayudas.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                {e.ayudas.map((a) => (
                  <li key={a.id} className="text-xs text-slate-500">
                    {a.fechaEntrega.toISOString().slice(0, 10)} · {a.tipoAyuda}: {a.cantidad}
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

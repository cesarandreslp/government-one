import { requerirContratista } from "@/lib/dal-contratista"
import { ContratistaAcciones } from "./contratista-acciones"

export const dynamic = "force-dynamic"

const ESTADO_CONTRATO_COLOR: Record<string, string> = {
  EN_EJECUCION: "bg-emerald-100 text-emerald-800",
  SUSPENDIDO: "bg-amber-100 text-amber-800",
}

export default async function ContratistaPage() {
  const ctx = await requerirContratista()
  const { db, terceroId } = ctx

  const contratos = await db.contrato.findMany({
    where: { terceroId, estado: { in: ["EN_EJECUCION", "SUSPENDIDO"] } },
    orderBy: { createdAt: "desc" },
    include: {
      actividades: { where: { activa: true }, orderBy: { orden: "asc" } },
      informesSupervision: { orderBy: { numero: "desc" }, include: { actividades: true } },
    },
  })

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Mis contratos</h1>
        <p className="text-sm text-slate-500">
          Reporta el avance de tus actividades por período — la IA redacta el informe a partir de lo que describas.
        </p>
      </header>

      {contratos.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
          No tienes contratos en ejecución en este momento.
        </p>
      ) : (
        <div className="space-y-4">
          {contratos.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs text-slate-500">{c.numero}</span>
                  <span className="ml-2 font-medium text-slate-800">{c.objeto}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_CONTRATO_COLOR[c.estado]}`}>{c.estado}</span>
              </div>

              {c.actividades.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">Tu entidad aún no ha definido actividades para este contrato.</p>
              ) : (
                <ContratistaAcciones
                  contratoId={c.id}
                  actividades={c.actividades.map((a) => ({ id: a.id, descripcion: a.descripcion }))}
                  informes={c.informesSupervision.map((i) => ({
                    id: i.id, numero: i.numero, periodo: i.periodo, estado: i.estado, observaciones: i.observaciones,
                    textoSupervisorIA: i.textoSupervisorIA,
                    actividades: i.actividades.map((ar) => ({ actividadId: ar.actividadId, descripcionContratista: ar.descripcionContratista, evidenciaUrl: ar.evidenciaUrl, textoIA: ar.textoIA })),
                  }))}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

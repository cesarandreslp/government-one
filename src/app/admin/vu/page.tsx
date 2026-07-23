import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { diasHabilesRestantes } from "@/lib/dias-habiles"
import { VuAcciones } from "./vu-acciones"

export const dynamic = "force-dynamic"

const TIPO_LABEL: Record<string, string> = {
  PETICION: "Petición", QUEJA: "Queja", RECLAMO: "Reclamo", SUGERENCIA: "Sugerencia", DENUNCIA: "Denuncia",
}
const ESTADO_COLOR: Record<string, string> = {
  RECIBIDA: "bg-amber-100 text-amber-800",
  ASIGNADA: "bg-blue-100 text-blue-700",
  EN_TRAMITE: "bg-indigo-100 text-indigo-700",
  RESPONDIDA: "bg-emerald-100 text-emerald-800",
  CERRADA: "bg-slate-200 text-slate-700",
}
const CERRADAS = new Set(["RESPONDIDA", "CERRADA"])

function semaforo(dias: number): { txt: string; cls: string } {
  if (dias < 0) return { txt: `vencida (${Math.abs(dias)}d)`, cls: "text-red-700" }
  if (dias <= 5) return { txt: `${dias}d hábiles`, cls: "text-amber-700" }
  return { txt: `${dias}d hábiles`, cls: "text-emerald-700" }
}

export default async function VuPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeRadicar, puedeResponder, puedeAsignar] = await Promise.all([
    funcionarioPuede(ctx, "ventanilla_unica", "radicar"),
    funcionarioPuede(ctx, "ventanilla_unica", "responder"),
    funcionarioPuede(ctx, "ventanilla_unica", "asignar"),
  ])

  const [dependencias, pqrsds] = await Promise.all([
    db.dependencia.findMany({ orderBy: { codigo: "asc" } }),
    db.pqrsd.findMany({
      orderBy: { fechaRecepcion: "desc" },
      take: 100,
      include: { dependencia: true, cargoAsignado: true, usuarioAsignado: true },
    }),
  ])

  const porEstado = pqrsds.reduce<Record<string, number>>((a, p) => ((a[p.estado] = (a[p.estado] ?? 0) + 1), a), {})
  const vencidas = pqrsds.filter((p) => !CERRADAS.has(p.estado) && diasHabilesRestantes(p.fechaVencimiento) < 0).length

  const pendientes = pqrsds
    .filter((p) => !CERRADAS.has(p.estado))
    .map((p) => ({ id: p.id, etiqueta: `${p.numero} · ${p.asunto} (hoy: ${p.dependencia?.codigo ?? "sin asignar"})` }))

  const sinAcceso = !puedeRadicar && !puedeResponder && !puedeAsignar

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Ventanilla Única</h1>
        <p className="text-sm text-slate-500">{pqrsds.length} PQRSD · asignación automática por cargo.</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Sin asignar", porEstado["RECIBIDA"] ?? 0],
          ["Asignadas", porEstado["ASIGNADA"] ?? 0],
          ["Respondidas", porEstado["RESPONDIDA"] ?? 0],
          ["Vencidas", vencidas],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`text-2xl font-semibold ${label === "Vencidas" && (n as number) > 0 ? "text-red-600" : "text-slate-800"}`}>{n}</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {sinAcceso && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidades de Ventanilla Única. Pídele a un administrador un cargo con
          <span className="font-mono"> ventanilla_unica</span> (radicar / responder / asignar).
        </div>
      )}

      <VuAcciones
        puedeRadicar={puedeRadicar}
        puedeResponder={puedeResponder}
        puedeAsignar={puedeAsignar}
        dependencias={dependencias.map((d) => ({ id: d.id, etiqueta: `${d.codigo} · ${d.nombre}`, compartida: d.esServicioCompartido }))}
        pendientes={pendientes}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Bandeja de PQRSD</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Peticionario</th>
                <th className="px-4 py-3">Asignada a</th>
                <th className="px-4 py-3">Término</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pqrsds.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aún no hay PQRSD.</td></tr>
              )}
              {pqrsds.map((p) => {
                const sem = semaforo(diasHabilesRestantes(p.fechaVencimiento))
                const cerrada = CERRADAS.has(p.estado)
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.numero}</td>
                    <td className="px-4 py-3 text-slate-500">{TIPO_LABEL[p.tipo]}</td>
                    <td className="px-4 py-3 text-slate-800">{p.asunto}</td>
                    <td className="px-4 py-3 text-slate-500">{p.peticionarioNombre}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.usuarioAsignado ? (
                        <div>
                          <div>{p.usuarioAsignado.nombre} {p.usuarioAsignado.apellido}</div>
                          <div className="text-xs text-slate-400">{p.cargoAsignado?.nombre} · {p.dependencia?.codigo}</div>
                        </div>
                      ) : (
                        <span className="text-amber-600">{p.cargoAsignado ? `${p.cargoAsignado.nombre} (sin ocupante)` : "sin asignar"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cerrada ? <span className="text-slate-400">—</span> : <span className={`text-xs font-medium ${sem.cls}`}>{sem.txt}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[p.estado] ?? "bg-slate-100 text-slate-700"}`}>{p.estado}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

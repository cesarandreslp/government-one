import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { EvaluacionAcciones } from "./evaluacion-acciones"

export const dynamic = "force-dynamic"

const NIVEL_COLOR: Record<string, string> = {
  SOBRESALIENTE: "bg-emerald-100 text-emerald-800",
  DESTACADO: "bg-blue-100 text-blue-700",
  SATISFACTORIO: "bg-amber-100 text-amber-800",
  NO_SATISFACTORIO: "bg-red-100 text-red-800",
}

export default async function EvaluacionPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeEvaluar] = await Promise.all([
    funcionarioPuede(ctx, "evaluacion_desempeno", "consultar"),
    funcionarioPuede(ctx, "evaluacion_desempeno", "evaluar"),
  ])
  const sinAcceso = !puedeConsultar && !puedeEvaluar

  if (sinAcceso) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Evaluación del Desempeño</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">evaluacion_desempeno</span>.
        </p>
      </main>
    )
  }

  const [evaluaciones, usuarios] = await Promise.all([
    db.evaluacionDesempeno.findMany({ orderBy: { createdAt: "desc" }, include: { usuario: true, evaluador: true } }),
    db.usuario.findMany({ where: { activo: true }, orderBy: { apellido: "asc" } }),
  ])

  const pendientesCalificar = evaluaciones.filter((e) => e.estado === "ACUERDO_ESTABLECIDO")

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Evaluación del Desempeño</h1>
        <p className="text-sm text-slate-500">{evaluaciones.length} acuerdo(s) de gestión · {pendientesCalificar.length} pendiente(s) de resultado.</p>
        <p className="mt-1 text-xs text-slate-400">La calificación la realiza el evaluador en la plataforma de la Función Pública; aquí se registra y digitaliza el resultado impreso que entrega el funcionario.</p>
      </header>

      <EvaluacionAcciones
        puedeEvaluar={puedeEvaluar}
        usuarios={usuarios.map((u) => ({ id: u.id, etiqueta: `${u.nombre} ${u.apellido}` }))}
        pendientesCalificar={pendientesCalificar.map((e) => ({ id: e.id, etiqueta: `${e.usuario.nombre} ${e.usuario.apellido} — ${e.periodo}` }))}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Acuerdos y calificaciones</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Funcionario</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Evaluador</th>
                <th className="px-4 py-3">Compromisos</th>
                <th className="px-4 py-3 text-right">Calificación</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Documento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evaluaciones.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aún no hay acuerdos de gestión.</td></tr>
              )}
              {evaluaciones.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{e.usuario.nombre} {e.usuario.apellido}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{e.periodo}</td>
                  <td className="px-4 py-3 text-slate-500">{e.evaluador ? `${e.evaluador.nombre} ${e.evaluador.apellido}` : "sin jefe inmediato definido"}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-600" title={e.compromisos}>{e.compromisos}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{e.calificacion ? Number(e.calificacion).toFixed(1) : "—"}</td>
                  <td className="px-4 py-3">
                    {e.nivel ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NIVEL_COLOR[e.nivel]}`}>{e.nivel}</span>
                    ) : (
                      <span className="text-xs text-slate-400">en curso</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.documentoUrl ? (
                      <a href={e.documentoUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 hover:underline">Ver escaneo</a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { SstAcciones } from "./sst-acciones"

export const dynamic = "force-dynamic"

const RIESGO_COLOR: Record<string, string> = {
  ACEPTABLE: "bg-emerald-100 text-emerald-800",
  MEJORABLE: "bg-amber-100 text-amber-800",
  NO_ACEPTABLE: "bg-red-100 text-red-800",
}
const RESULTADO_COLOR: Record<string, string> = {
  APTO: "bg-emerald-100 text-emerald-800",
  APTO_CON_RESTRICCIONES: "bg-amber-100 text-amber-800",
  NO_APTO: "bg-red-100 text-red-800",
}

export default async function SstPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "sst", "consultar"),
    funcionarioPuede(ctx, "sst", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Seguridad y Salud en el Trabajo</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">sst</span>.
        </p>
      </main>
    )
  }

  const [riesgos, incidentes, examenes, cargos, usuarios] = await Promise.all([
    db.sstRiesgoCargo.findMany({ orderBy: { createdAt: "desc" }, include: { cargo: { include: { dependencia: true } } } }),
    db.sstIncidente.findMany({ orderBy: { fecha: "desc" }, include: { usuario: true } }),
    db.sstExamenMedico.findMany({ orderBy: { fecha: "desc" }, include: { usuario: true } }),
    db.cargo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, include: { dependencia: true } }),
    db.usuario.findMany({ where: { activo: true }, orderBy: { apellido: "asc" } }),
  ])

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Seguridad y Salud en el Trabajo</h1>
        <p className="text-sm text-slate-500">
          {riesgos.length} riesgo(s) en matriz · {incidentes.length} accidente(s)/incidente(s) · {examenes.length} examen(es) médico(s).
        </p>
        <p className="mt-1 text-xs text-slate-400">Registro interno (SG-SST, Decreto 1072/2015) — no reemplaza el reporte oficial FURAT/FUREL ante la ARL.</p>
      </header>

      <SstAcciones
        puedeAdministrar={puedeAdministrar}
        cargos={cargos.map((c) => ({ id: c.id, etiqueta: `${c.dependencia.codigo} · ${c.nombre}` }))}
        usuarios={usuarios.map((u) => ({ id: u.id, etiqueta: `${u.nombre} ${u.apellido}` }))}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Matriz de riesgos por cargo</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Cargo</th><th className="px-4 py-3">Peligro</th><th className="px-4 py-3">Riesgo</th><th className="px-4 py-3">Nivel</th><th className="px-4 py-3">Medidas de control</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {riesgos.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aún no hay riesgos registrados.</td></tr>}
              {riesgos.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{r.cargo.dependencia.codigo} · {r.cargo.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{r.peligro}</td>
                  <td className="px-4 py-3 text-slate-600">{r.riesgo}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RIESGO_COLOR[r.nivelRiesgo]}`}>{r.nivelRiesgo}</span></td>
                  <td className="px-4 py-3 text-slate-500">{r.medidasControl ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Accidentalidad e incidentes</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Funcionario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3 text-right">Días inc.</th><th className="px-4 py-3">Reportado ARL</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {incidentes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin accidentalidad registrada.</td></tr>}
              {incidentes.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{i.usuario.nombre} {i.usuario.apellido}</td>
                  <td className="px-4 py-3 text-slate-600">{i.tipo}</td>
                  <td className="px-4 py-3 text-slate-500">{i.fecha.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">{i.descripcion}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{i.diasIncapacidad ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{i.reportadoArl ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Exámenes médicos ocupacionales</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Funcionario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Observaciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {examenes.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin exámenes registrados.</td></tr>}
              {examenes.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{e.usuario.nombre} {e.usuario.apellido}</td>
                  <td className="px-4 py-3 text-slate-600">{e.tipo}</td>
                  <td className="px-4 py-3 text-slate-500">{e.fecha.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESULTADO_COLOR[e.resultado]}`}>{e.resultado}</span></td>
                  <td className="px-4 py-3 text-slate-500">{e.observaciones ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

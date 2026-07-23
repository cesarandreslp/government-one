import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { RrhhAcciones } from "./rrhh-acciones"

export const dynamic = "force-dynamic"

const VIA_LABEL: Record<string, string> = { TITULAR: "titular", ENCARGADO: "encargo", PROVISIONAL: "provisional" }
const AUSENCIA_LABEL: Record<string, string> = { VACACIONES: "vacaciones", LICENCIA: "licencia", COMISION: "comisión", INCAPACIDAD: "incapacidad" }
const NIVEL_LABEL: Record<string, string> = { ASISTENCIAL: "Asistencial", TECNICO: "Técnico", PROFESIONAL: "Profesional", ASESOR: "Asesor", DIRECTIVO: "Directivo" }

function hoy(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function RrhhPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeGestionarFuncionarios, puedeActosAdministrativos, puedeConsultar] = await Promise.all([
    funcionarioPuede(ctx, "gestion_humana", "gestionar_funcionarios"),
    funcionarioPuede(ctx, "gestion_humana", "actos_administrativos"),
    funcionarioPuede(ctx, "gestion_humana", "consultar"),
  ])
  const sinAcceso = !puedeGestionarFuncionarios && !puedeActosAdministrativos && !puedeConsultar

  if (sinAcceso) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Talento Humano</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes ninguna capacidad de Talento Humano asignada. Pide a tu jefe de dependencia que te
          vincule con un cargo que tenga capacidades <code>gestion_humana</code>.
        </p>
      </main>
    )
  }

  const [usuarios, cargos] = await Promise.all([
    db.usuario.findMany({
      orderBy: { apellido: "asc" },
      include: {
        vinculaciones: { orderBy: { desde: "desc" }, include: { cargo: { include: { dependencia: true } } } },
        ausencias: { orderBy: { desde: "desc" } },
      },
    }),
    db.cargo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, include: { dependencia: true } }),
  ])

  const ahora = hoy()
  const vigente = (r: { desde: Date; hasta: Date | null }) => r.desde <= ahora && (r.hasta === null || r.hasta >= ahora)

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Talento Humano</h1>
        <p className="text-sm text-slate-500">
          Funcionarios, actos administrativos (posesión, encargo, provisional) y ausencias. {usuarios.length} funcionario(s).
        </p>
      </header>

      <RrhhAcciones
        puedeGestionarFuncionarios={puedeGestionarFuncionarios}
        puedeActosAdministrativos={puedeActosAdministrativos}
        funcionarios={usuarios.map((u) => ({ id: u.id, nombre: `${u.nombre} ${u.apellido}` }))}
        cargos={cargos.map((c) => ({ id: c.id, nombre: `${c.nombre}${c.nivel ? ` (${NIVEL_LABEL[c.nivel]})` : ""}`, depCodigo: c.dependencia.codigo }))}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Funcionarios</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Funcionario</th>
                <th className="px-4 py-3">Cargos (histórico)</th>
                <th className="px-4 py-3">Ausencias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Aún no hay funcionarios.</td></tr>
              )}
              {usuarios.map((u) => (
                <tr key={u.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{u.nombre} {u.apellido}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.vinculaciones.length === 0
                      ? <span className="text-slate-400">sin actos registrados</span>
                      : u.vinculaciones.map((v) => (
                          <div key={v.id} className="mb-1.5 text-xs">
                            <span className={vigente(v) ? "font-medium text-slate-700" : "text-slate-400 line-through"}>
                              {v.cargo.dependencia.codigo} · {v.cargo.nombre}
                            </span>{" "}
                            <span className="text-slate-400">({VIA_LABEL[v.tipo] ?? v.tipo}{v.actoAdmin ? ` · ${v.actoAdmin}` : ""})</span>
                          </div>
                        ))}
                  </td>
                  <td className="px-4 py-3">
                    {u.ausencias.length === 0
                      ? <span className="text-slate-400">—</span>
                      : u.ausencias.map((a) => (
                          <div key={a.id} className="mb-1.5 text-xs">
                            <span className={vigente(a) ? "font-medium text-amber-700" : "text-slate-400"}>
                              {AUSENCIA_LABEL[a.tipo] ?? a.tipo}
                            </span>{" "}
                            <span className="text-slate-400">
                              {a.desde.toISOString().slice(0, 10)} → {a.hasta.toISOString().slice(0, 10)}
                            </span>
                          </div>
                        ))}
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

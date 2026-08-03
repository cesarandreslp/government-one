import Link from "next/link"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { ParticipacionAcciones } from "./participacion-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  ACTIVA: "bg-emerald-100 text-emerald-800",
  INACTIVA: "bg-slate-200 text-slate-500",
}

export default async function ParticipacionCiudadanaPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "participacion_ciudadana", "consultar"),
    funcionarioPuede(ctx, "participacion_ciudadana", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Participación Ciudadana</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">participacion_ciudadana</span>.
        </p>
      </main>
    )
  }

  const hoy = new Date()
  const [jacs, personas] = await Promise.all([
    db.jac.findMany({ orderBy: { nombre: "asc" }, include: { dignatarios: { include: { persona: true }, orderBy: { periodoInicio: "desc" } } } }),
    db.tercero.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ])

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Participación Ciudadana y Acción Comunal</h1>
        <p className="text-sm text-slate-500">{jacs.length} Junta(s) de Acción Comunal registrada(s).</p>
        <p className="mt-1 text-xs text-slate-400">
          Registro de JAC y sus dignatarios por período (4 años, Ley 743/2002) — RUES/certificados nacionales
          no son competencia municipal, esto es el registro local que la Secretaría lleva de sus organismos comunales.
        </p>
      </header>

      <ParticipacionAcciones
        puedeAdministrar={puedeAdministrar}
        jacs={jacs.map((j) => ({ id: j.id, etiqueta: `${j.nombre} (${j.barrioVereda})` }))}
        personas={personas.map((p) => ({ id: p.id, etiqueta: `${p.razonSocial} (${p.documento})` }))}
      />

      <section className="mt-8 grid gap-3">
        {jacs.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay JAC registradas.</p>
        )}
        {jacs.map((j) => {
          const vigentes = j.dignatarios.filter((d) => d.periodoInicio <= hoy && d.periodoFin >= hoy)
          return (
            <div key={j.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-800">{j.nombre}</span>
                  <span className="ml-2 text-xs text-slate-400">{j.barrioVereda}</span>
                  {j.personeriaJuridica && <span className="ml-2 text-xs text-slate-400">Personería {j.personeriaJuridica}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[j.estado]}`}>{j.estado}</span>
                  <Link href={`/admin/participacion-ciudadana/certificado?jacId=${j.id}`} className="text-xs font-medium text-blue-600 hover:underline">Certificado</Link>
                </div>
              </div>
              {vigentes.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">Sin dignatarios vigentes.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                  {vigentes.map((d) => (
                    <li key={d.id} className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                      {d.cargo}: {d.persona.razonSocial}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </section>
    </main>
  )
}

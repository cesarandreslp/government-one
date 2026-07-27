import Link from "next/link"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { SisbenAcciones } from "./sisben-acciones"

export const dynamic = "force-dynamic"

const GRUPO_COLOR: Record<string, string> = {
  A: "bg-red-100 text-red-700",
  B: "bg-amber-100 text-amber-800",
  C: "bg-blue-100 text-blue-700",
  D: "bg-slate-100 text-slate-700",
}

export default async function SisbenPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "sisben", "consultar"),
    funcionarioPuede(ctx, "sisben", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">SISBEN</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">sisben</span>.
        </p>
      </main>
    )
  }

  const [registros, personas] = await Promise.all([
    db.sisbenRegistro.findMany({ orderBy: { createdAt: "desc" }, include: { persona: true } }),
    db.tercero.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ])

  const vigentes = registros.filter((r) => r.vigente)

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">SISBEN</h1>
        <p className="text-sm text-slate-500">{registros.length} ficha(s) · {vigentes.length} vigente(s).</p>
        <p className="mt-1 text-xs text-slate-400">
          Registro local de clasificación socioeconómica a partir de los cargues del DNP — no es una
          consulta en vivo del sistema nacional (sin API pública).
        </p>
      </header>

      <SisbenAcciones
        puedeAdministrar={puedeAdministrar}
        personas={personas.map((p) => ({ id: p.id, etiqueta: `${p.razonSocial} (${p.documento})` }))}
        registros={registros.map((r) => ({ id: r.id, etiqueta: `${r.ficha} · ${r.persona.razonSocial} (${r.vigente ? "vigente" : "no vigente"})` }))}
      />

      <section className="mt-8 grid gap-3">
        {registros.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay fichas registradas.</p>
        )}
        {registros.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-sm text-slate-700">{r.ficha}</span>{" "}
                <span className="text-sm text-slate-800">{r.persona.razonSocial}</span>
                <span className="ml-2 text-xs text-slate-400">{r.persona.documento}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRUPO_COLOR[r.grupo]}`}>Grupo {r.grupo}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.vigente ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"}`}>
                  {r.vigente ? "VIGENTE" : "NO VIGENTE"}
                </span>
                <Link href={`/admin/sisben/certificado?registroId=${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">Certificado</Link>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Encuesta {r.fechaEncuesta.toISOString().slice(0, 10)}{r.puntaje !== null && ` · puntaje ${Number(r.puntaje)}`}
              {r.observaciones && ` · ${r.observaciones}`}
            </p>
          </div>
        ))}
      </section>
    </main>
  )
}

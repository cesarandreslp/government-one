import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { AdultoMayorAcciones } from "./adulto-mayor-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  POSTULADO: "bg-amber-100 text-amber-800",
  ACTIVO: "bg-emerald-100 text-emerald-800",
  RETIRADO: "bg-slate-200 text-slate-500",
}

export default async function AdultoMayorPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar] = await Promise.all([
    funcionarioPuede(ctx, "adulto_mayor", "consultar"),
    funcionarioPuede(ctx, "adulto_mayor", "administrar"),
  ])
  if (!puedeConsultar && !puedeAdministrar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Adulto Mayor</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">adulto_mayor</span>.
        </p>
      </main>
    )
  }

  const [beneficiarios, personas] = await Promise.all([
    db.beneficiarioAdultoMayor.findMany({ orderBy: { createdAt: "desc" }, include: { persona: true } }),
    db.tercero.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
  ])

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Adulto Mayor</h1>
        <p className="text-sm text-slate-500">{beneficiarios.length} beneficiario(s) registrado(s).</p>
        <p className="mt-1 text-xs text-slate-400">
          Colombia Mayor es un subsidio nacional (Prosperidad Social) — el municipio hace la
          postulación/enlace local, no administra el pago. Centro Día/Centro de Bienestar del Anciano sí
          son programas propios de la entidad.
        </p>
      </header>

      <AdultoMayorAcciones
        puedeAdministrar={puedeAdministrar}
        personas={personas.map((p) => ({ id: p.id, etiqueta: `${p.razonSocial} (${p.documento})` }))}
        beneficiarios={beneficiarios.map((b) => ({ id: b.id, etiqueta: `${b.persona.razonSocial} · ${b.programa} (${b.estado})` }))}
      />

      <section className="mt-8 grid gap-3">
        {beneficiarios.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay beneficiarios registrados.</p>
        )}
        {beneficiarios.map((b) => (
          <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-slate-800">{b.persona.razonSocial}</span>
                <span className="ml-2 text-xs text-slate-400">{b.persona.documento}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{b.programa.replaceAll("_", " ")}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[b.estado]}`}>{b.estado}</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Ingreso {b.fechaIngreso.toISOString().slice(0, 10)}{b.observaciones && ` · ${b.observaciones}`}
            </p>
          </div>
        ))}
      </section>
    </main>
  )
}

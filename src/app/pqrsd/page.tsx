import { contextoTenant } from "@/lib/contexto-tenant"
import { PortalShell } from "../portal-shell"
import { RadicarForm, ConsultaForm } from "./pqrsd-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "PQRSD — Atención al ciudadano" }

// Superficie PÚBLICA de PQRSD (portal del tenant). Radicar + consultar por número. Sin sesión.
export default async function PqrsdPage() {
  const ctx = await contextoTenant()

  if (!ctx) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24 text-center text-slate-500">
        Esta dirección no corresponde a ninguna entidad.
      </main>
    )
  }

  return (
    <PortalShell nombre={ctx.tenant.nombre}>
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Peticiones, Quejas, Reclamos, Sugerencias y Denuncias</h1>
        <p className="mt-2 text-sm text-slate-600">
          Radica tu solicitud ante {ctx.tenant.nombre}. La entidad la asignará al área competente y responderá
          dentro de los términos de ley.
        </p>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Radicar solicitud</h2>
          <RadicarForm />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Consultar estado</h2>
          <ConsultaForm />
        </section>
      </div>
    </PortalShell>
  )
}

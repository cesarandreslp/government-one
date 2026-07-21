import { contextoTenant } from "@/lib/contexto-tenant"
import { PortalShell } from "../portal-shell"
import { CATEGORIAS_TRANSPARENCIA } from "@/lib/transparencia"

export const dynamic = "force-dynamic"
export const metadata = { title: "Transparencia y acceso a la información pública" }

// Sección "Transparencia y acceso a la información pública" (Res. MinTIC 1519/2020). La estructura
// (12 categorías) es primitivo nacional; el CONTENIDO por categoría lo publica cada tenant (pendiente
// el modelo de contenido del micrositio en la BD del tenant) → hoy estado vacío por categoría.
export default async function TransparenciaPage() {
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
      <div className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transparencia y acceso a la información pública</h1>
        <p className="mt-2 text-sm text-slate-600">
          {ctx.tenant.nombre} · esquema de publicación conforme a la Resolución MinTIC 1519 de 2020 (Gov.co).
        </p>

        <div className="mt-8 grid gap-3">
          {CATEGORIAS_TRANSPARENCIA.map((c) => (
            <div key={c.numero} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-blue-100 text-sm font-semibold text-blue-800">{c.numero}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">{c.titulo}</div>
              </div>
              <span className="text-xs text-slate-400">Sin publicar</span>
            </div>
          ))}
        </div>
      </div>
    </PortalShell>
  )
}

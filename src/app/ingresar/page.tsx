import { contextoTenant } from "@/lib/contexto-tenant"
import { IngresarForm } from "./ingresar-form"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Ingreso de funcionarios",
}

// Login del FUNCIONARIO del tenant (resuelto por host). Distinto del /login del superadmin de
// plataforma. Muestra el nombre de la entidad del host; si el host no mapea a un tenant, avisa.
export default async function IngresarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const destino = next?.startsWith("/admin") ? next : "/admin/estructura"
  const ctx = await contextoTenant()

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 font-bold text-white mx-auto">
            G1
          </span>
          <h1 className="mt-6 text-xl font-semibold text-slate-900">
            {ctx ? ctx.tenant.nombre : "Entidad no encontrada"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ctx ? "Acceso de funcionarios" : "Esta dirección no corresponde a ninguna entidad activa."}
          </p>
        </div>

        {ctx && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <IngresarForm next={destino} />
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Government One · plataforma para entidades públicas
        </p>
      </div>
    </main>
  )
}

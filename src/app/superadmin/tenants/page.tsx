import { prismaMeta } from "@/lib/prisma-meta"
import { ProvisionForm } from "./provision-form"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  ACTIVO: "bg-emerald-100 text-emerald-800",
  CREANDO_NEON: "bg-amber-100 text-amber-800",
  APLICANDO_SCHEMA: "bg-amber-100 text-amber-800",
  SEMBRANDO: "bg-amber-100 text-amber-800",
  FALLIDO: "bg-red-100 text-red-800",
  SUSPENDIDO: "bg-slate-200 text-slate-700",
}

export default async function TenantsPage() {
  const tenants = await prismaMeta.tenant.findMany({ orderBy: { createdAt: "desc" } })

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Superadmin — Tenants</h1>
        <p className="text-sm text-slate-500">
          Directorio de la flota. {tenants.length} tenant(s) registrado(s).
        </p>
      </header>

      <div className="mb-8">
        <ProvisionForm />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Dominio</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Aún no hay tenants. Provisiona el primero arriba.
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{t.slug}</td>
                <td className="px-4 py-3 text-slate-700">{t.nombre}</td>
                <td className="px-4 py-3 text-slate-500">{t.tipoEntidad}</td>
                <td className="px-4 py-3 text-slate-500">{t.dominioPrincipal}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ESTADO_COLOR[t.estadoProvision] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {t.estadoProvision}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

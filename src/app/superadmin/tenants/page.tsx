import { prismaMeta } from "@/lib/prisma-meta"
import { ProvisionForm } from "./provision-form"
import { ModulosTenant } from "./modulos-tenant"
import { SecretoIa } from "./secreto-ia"
import { MODULOS_CONTRATABLES } from "@/lib/modulos"
import { obtenerSecretoTenant, type ProveedorIA } from "@/lib/tenant-secretos"

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
  // Solo se extrae el PROVEEDOR (no sensible) para mostrarlo — la clave nunca sale del servidor.
  const iaProveedor = new Map(
    await Promise.all(
      tenants.map(async (t) => {
        const cred = await obtenerSecretoTenant(t.id, "ia")
        return [t.id, cred?.proveedor ?? null] as const
      }),
    ),
  )

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

      {tenants.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
          Aún no hay tenants. Provisiona el primero arriba.
        </p>
      )}

      <div className="space-y-4">
        {tenants.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-slate-800">{t.nombre}</span>
              <span className="font-mono text-xs text-slate-400">{t.slug}</span>
              <span className="text-xs text-slate-500">{t.tipoEntidad}</span>
              <span className="text-xs text-slate-500">{t.dominioPrincipal}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[t.estadoProvision] ?? "bg-slate-100 text-slate-700"}`}>
                {t.estadoProvision}
              </span>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Módulos contratados</p>
              <ModulosTenant
                tenantId={t.id}
                contratados={Array.isArray(t.modulosContratados) ? (t.modulosContratados as string[]) : []}
                contratables={MODULOS_CONTRATABLES.map((m) => ({ id: m.id, nombre: m.nombre, categoria: m.categoria }))}
              />
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clasificación de PQRSD por IA</p>
              <SecretoIa tenantId={t.id} configurada={!!iaProveedor.get(t.id)} proveedorActual={(iaProveedor.get(t.id) ?? null) as ProveedorIA | null} />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

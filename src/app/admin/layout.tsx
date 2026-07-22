import Link from "next/link"
import { requerirFuncionario, modulosVisibles, ROLES_ADMIN_TENANT } from "@/lib/dal-tenant"
import { salirAction } from "@/app/ingresar/actions"
import { MODULOS } from "@/lib/modulos"

// Cerradura real de /admin/* del TENANT (cerca de los datos, no solo en el proxy). Resuelve el
// tenant por host y exige sesión de funcionario válida para ESE tenant. El nav es GOBERNADO:
// muestra solo los módulos disponibles+asignados al funcionario (el admin ve todos los disponibles).
export default async function AdminTenantLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requerirFuncionario()
  const { tenant, sesion } = ctx

  const esAdmin = ROLES_ADMIN_TENANT.includes(sesion.rol)
  const visibles = new Set(await modulosVisibles(ctx, MODULOS.map((m) => m.id)))
  const modulosNav = MODULOS.filter((m) => m.ruta && visibles.has(m.id))

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin/estructura" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-xs font-bold text-white">
                G1
              </span>
              <span className="text-sm font-semibold tracking-tight text-slate-900">{tenant.nombre}</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {esAdmin && (
                <Link href="/admin/estructura" className="text-slate-600 hover:text-slate-900">
                  Estructura
                </Link>
              )}
              {modulosNav.map((m) => (
                <Link key={m.id} href={m.ruta!} className="text-slate-600 hover:text-slate-900">
                  {m.nombre}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {sesion.nombre} · {sesion.rol}
            </span>
            <form action={salirAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  )
}

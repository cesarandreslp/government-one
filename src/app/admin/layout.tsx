import Link from "next/link"
import { requerirFuncionario } from "@/lib/dal-tenant"
import { salirAction } from "@/app/ingresar/actions"

// Cerradura real de /admin/* del TENANT (cerca de los datos, no solo en el proxy). Resuelve el
// tenant por host y exige sesión de funcionario válida para ESE tenant.
export default async function AdminTenantLayout({ children }: { children: React.ReactNode }) {
  const { tenant, sesion } = await requerirFuncionario()

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
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/estructura" className="text-slate-600 hover:text-slate-900">
                Estructura
              </Link>
              <Link href="/admin/gd" className="text-slate-600 hover:text-slate-900">
                Gestión Documental
              </Link>
              <Link href="/admin/vu" className="text-slate-600 hover:text-slate-900">
                Ventanilla Única
              </Link>
              <Link href="/admin/contabilidad" className="text-slate-600 hover:text-slate-900">
                Contabilidad
              </Link>
              <Link href="/admin/presupuesto" className="text-slate-600 hover:text-slate-900">
                Presupuesto
              </Link>
              <Link href="/admin/proyectos" className="text-slate-600 hover:text-slate-900">
                Proyectos
              </Link>
              <Link href="/admin/contratacion" className="text-slate-600 hover:text-slate-900">
                Contratación
              </Link>
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

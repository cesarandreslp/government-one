import { requerirContratista } from "@/lib/dal-contratista"
import { salirAction } from "@/app/ingresar/actions"

// Portal del CONTRATISTA (identidad externa) — separado de /admin: no hay nav de módulos (el
// contratista no tiene cargo/capacidades), solo sus contratos e informes de supervisión.
export default async function ContratistaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requerirContratista()

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-xs font-bold text-white">G1</span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">{ctx.tenant.nombre} · Portal del contratista</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">{ctx.sesion.nombre}</span>
            <form action={salirAction}>
              <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
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

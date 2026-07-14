import Link from "next/link"
import { requerirAdmin } from "@/lib/dal"
import { logoutAction } from "@/app/login/actions"

// Cerradura real de /superadmin/* (cerca de los datos, no solo en el proxy).
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requerirAdmin()

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/superadmin/tenants" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-xs font-bold text-white">
              G1
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Government One · Control plane
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">{admin.email}</span>
            <form action={logoutAction}>
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

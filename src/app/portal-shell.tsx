import Link from "next/link"

// Cascarón del PORTAL PÚBLICO del tenant (cabecera + pie), reutilizado por la home, Transparencia
// y PQRSD. El nombre de la entidad sale de la data del tenant (cero hardcode).
export function PortalShell({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-white text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-sm font-bold text-white">GC</span>
            <span className="text-base font-semibold tracking-tight">{nombre}</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-600 hover:text-slate-900">Inicio</Link>
            <Link href="/transparencia" className="text-slate-600 hover:text-slate-900">Transparencia</Link>
            <Link href="/pqrsd" className="text-slate-600 hover:text-slate-900">PQRSD</Link>
            <Link href="/ingresar" className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
              Acceso funcionarios
            </Link>
          </div>
        </nav>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} {nombre}</span>
          <span className="text-xs text-slate-400">Portal Gov.co · Government One</span>
        </div>
      </footer>
    </div>
  )
}

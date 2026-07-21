import Link from "next/link"
import { PortalShell } from "./portal-shell"
import { CATEGORIAS_TRANSPARENCIA } from "@/lib/transparencia"

interface DependenciaNodo {
  id: string
  codigo: string
  nombre: string
  tipo: string
  padreId: string | null
}

// PORTAL PÚBLICO del tenant (home). Todo sale de la data del tenant: nombre + árbol de
// dependencias. Sin contenido de entidad quemado; lo no cargado se muestra como estado vacío.
export function PortalTenant({ nombre, dependencias }: { nombre: string; dependencias: DependenciaNodo[] }) {
  const porId = new Map(dependencias.map((d) => [d.id, d]))
  const profundidad = (id: string): number => {
    let n = 0
    let cur = porId.get(id)
    while (cur?.padreId) { n++; cur = porId.get(cur.padreId) }
    return n
  }
  const arbol = [...dependencias].sort((a, b) => profundidad(a.id) - profundidad(b.id) || a.codigo.localeCompare(b.codigo))

  return (
    <PortalShell nombre={nombre}>
      {/* Hero */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="mb-3 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">Portal institucional · Gov.co</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900">{nombre}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Atención al ciudadano en línea: radica tus peticiones, quejas, reclamos, sugerencias o denuncias y
            consulta la información pública de la entidad.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/pqrsd" className="rounded-lg bg-blue-700 px-6 py-3 text-sm font-medium text-white hover:bg-blue-800">
              Radicar PQRSD
            </Link>
            <Link href="/transparencia" className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Transparencia y acceso a la información
            </Link>
          </div>
        </div>
      </section>

      {/* Directorio de dependencias */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-6 text-xl font-bold tracking-tight text-slate-900">Estructura de la entidad</h2>
        {arbol.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-400">
            La entidad aún no ha publicado su estructura.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {arbol.map((d) => (
              <div key={d.id} className="rounded-xl border border-slate-200 p-4" style={{ marginLeft: Math.min(profundidad(d.id), 2) * 12 }}>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{d.codigo}</span>
                  <span className="text-xs uppercase tracking-wide text-slate-400">{d.tipo}</span>
                </div>
                <div className="mt-1 text-sm font-medium text-slate-800">{d.nombre}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Transparencia (menú Res. 1519) */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="mb-6 text-xl font-bold tracking-tight text-slate-900">Transparencia y acceso a la información pública</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIAS_TRANSPARENCIA.map((c) => (
              <Link key={c.numero} href="/transparencia" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm hover:border-blue-300">
                <span className="grid h-6 w-6 flex-none place-items-center rounded bg-blue-100 text-xs font-semibold text-blue-800">{c.numero}</span>
                <span className="text-slate-700">{c.titulo}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PortalShell>
  )
}

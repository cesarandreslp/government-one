import Link from "next/link"
import { obtenerPagina, bloque } from "@/lib/cms"
import type { HeroContenido, ValoresContenido, ModulosContenido } from "@/lib/cms"

// Landing corporativa de la PLATAFORMA (SaaS), alimentada del CMS (meta-DB). Se muestra en el
// host de plataforma (government-one.vercel.app); en el host de un tenant se muestra su portal.
export async function LandingPlataforma() {
  const pagina = await obtenerPagina("landing")
  const hero = bloque(pagina, "hero")?.contenido as HeroContenido | undefined
  const valores = (bloque(pagina, "valores")?.contenido as ValoresContenido | undefined)?.items ?? []
  const modulos = (bloque(pagina, "modulos")?.contenido as ModulosContenido | undefined)?.items ?? []

  return (
    <div className="flex flex-1 flex-col bg-white text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 font-bold text-white">G1</span>
            <span className="text-lg font-semibold tracking-tight">Government One</span>
          </div>
          <Link href="/login" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            Acceso administrativo
          </Link>
        </nav>
      </header>

      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          {hero?.badge && (
            <p className="mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{hero.badge}</p>
          )}
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {hero?.titulo ?? "Government One"}
          </h1>
          {hero?.subtitulo && <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">{hero.subtitulo}</p>}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              {hero?.ctaTexto ?? "Acceso administrativo (SaaS)"}
            </Link>
            <a href="#modulos" className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Ver módulos
            </a>
          </div>
        </div>
      </section>

      {valores.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {valores.map((v) => (
              <div key={v.titulo} className="rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900">{v.titulo}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{v.texto}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="modulos" className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Módulos de la plataforma</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
              Cada módulo se describe a fondo y con pantallas reales de la aplicación a medida que se construye.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((m) => (
              <div key={m.nombre} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">{m.nombre}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.estado === "Fundación" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {m.estado}
                  </span>
                </div>
                <p className="text-sm leading-6 text-slate-600">{m.resumen}</p>
                {m.capturas && m.capturas.length > 0 ? (
                  <div className="mt-4 grid gap-2">
                    {m.capturas.map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt={`Pantalla de ${m.nombre}`} className="w-full rounded-lg border border-slate-200" />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 grid h-28 place-items-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                    Pantallas del módulo · próximamente
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Government One — OSS Innovation</span>
          <Link href="/login" className="font-medium text-blue-600 hover:underline">Acceso administrativo →</Link>
        </div>
      </footer>
    </div>
  )
}

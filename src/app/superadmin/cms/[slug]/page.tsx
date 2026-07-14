import Link from "next/link"
import { notFound } from "next/navigation"
import { obtenerPagina, bloque } from "@/lib/cms"
import type { HeroContenido, ValoresContenido, ModulosContenido } from "@/lib/cms"
import { HeroEditor } from "./hero-editor"
import { ValoresEditor } from "./valores-editor"
import { ModulosEditor } from "./modulos-editor"

export const dynamic = "force-dynamic"

const HERO_VACIO: HeroContenido = { badge: "", titulo: "", subtitulo: "", ctaTexto: "" }

export default async function EditarPagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pagina = await obtenerPagina(slug)
  if (!pagina) notFound()

  const hero = (bloque(pagina, "hero")?.contenido as HeroContenido | undefined) ?? HERO_VACIO
  const valores = (bloque(pagina, "valores")?.contenido as ValoresContenido | undefined)?.items ?? []
  const modulos = (bloque(pagina, "modulos")?.contenido as ModulosContenido | undefined)?.items ?? []

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/superadmin/cms" className="text-sm text-blue-600 hover:underline">
            ← CMS
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{pagina.titulo}</h1>
          <p className="text-sm text-slate-500">
            /{pagina.slug} · {pagina.publicada ? "Publicada" : "Borrador"}
          </p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Ver landing ↗
        </a>
      </div>

      <div className="flex flex-col gap-8">
        <Seccion titulo="Hero" descripcion="Encabezado principal de la landing.">
          <HeroEditor slug={pagina.slug} valor={hero} />
        </Seccion>

        <Seccion titulo="Valores" descripcion="Tarjetas de propuesta de valor.">
          <ValoresEditor slug={pagina.slug} valor={valores} />
        </Seccion>

        <Seccion titulo="Módulos" descripcion="Catálogo de módulos de la plataforma. Las URLs de pantallas se llenarán cuando cada módulo exista.">
          <ModulosEditor slug={pagina.slug} valor={modulos} />
        </Seccion>
      </div>
    </div>
  )
}

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <p className="mb-4 text-sm text-slate-500">{descripcion}</p>
      {children}
    </section>
  )
}

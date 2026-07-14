import { prismaMeta } from "@/lib/prisma-meta"

// Tipos de contenido de la landing (payload JSON de cada bloque, por `clave`).
export interface HeroContenido {
  badge: string
  titulo: string
  subtitulo: string
  ctaTexto: string
}

export interface Valor {
  titulo: string
  texto: string
}
export interface ValoresContenido {
  items: Valor[]
}

export interface Modulo {
  nombre: string
  resumen: string
  estado: string // "Fundación" | "Planeado" | "Disponible" (catálogo, no quemado en el render)
  capturas: string[] // URLs de pantallas; vacío = "próximamente"
}
export interface ModulosContenido {
  items: Modulo[]
}

export interface BloqueDTO {
  clave: string
  tipo: string
  orden: number
  visible: boolean
  contenido: unknown
}

export interface PaginaDTO {
  slug: string
  titulo: string
  publicada: boolean
  bloques: BloqueDTO[]
}

/** Lee una página del CMS con sus bloques ordenados. `null` si no existe. */
export async function obtenerPagina(slug: string): Promise<PaginaDTO | null> {
  const pagina = await prismaMeta.paginaCms.findUnique({
    where: { slug },
    include: { bloques: { orderBy: { orden: "asc" } } },
  })
  if (!pagina) return null
  return {
    slug: pagina.slug,
    titulo: pagina.titulo,
    publicada: pagina.publicada,
    bloques: pagina.bloques.map((b) => ({
      clave: b.clave,
      tipo: b.tipo,
      orden: b.orden,
      visible: b.visible,
      contenido: b.contenido,
    })),
  }
}

/** Devuelve el contenido del bloque con esa `clave` (o null). */
export function bloque(pagina: PaginaDTO | null, clave: string): BloqueDTO | null {
  return pagina?.bloques.find((b) => b.clave === clave && b.visible) ?? null
}

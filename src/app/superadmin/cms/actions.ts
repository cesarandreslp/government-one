"use server"

import { revalidatePath } from "next/cache"
import { prismaMeta } from "@/lib/prisma-meta"
import { requerirAdmin } from "@/lib/dal"

export interface GuardarState {
  ok?: boolean
  error?: string
  mensaje?: string
}

/**
 * Guarda el contenido (JSON) de un bloque identificado por (slug de página, clave).
 * El contenido llega serializado desde el editor cliente en el campo `contenido`.
 */
export async function guardarBloqueAction(
  _prev: GuardarState,
  formData: FormData,
): Promise<GuardarState> {
  await requerirAdmin()

  const slug = String(formData.get("slug") ?? "")
  const clave = String(formData.get("clave") ?? "")
  const crudo = String(formData.get("contenido") ?? "")

  if (!slug || !clave) return { ok: false, error: "Falta la página o el bloque." }

  let contenido: unknown
  try {
    contenido = JSON.parse(crudo)
  } catch {
    return { ok: false, error: "El contenido no es un JSON válido." }
  }

  const pagina = await prismaMeta.paginaCms.findUnique({ where: { slug } })
  if (!pagina) return { ok: false, error: "La página no existe." }

  await prismaMeta.bloqueCms.update({
    where: { paginaId_clave: { paginaId: pagina.id, clave } },
    data: { contenido: contenido as object },
  })

  // Refresca la landing pública y el editor.
  revalidatePath("/")
  revalidatePath(`/superadmin/cms/${slug}`)
  return { ok: true, mensaje: "Guardado." }
}

/** Publica/despublica una página. */
export async function togglePublicadaAction(slug: string, publicada: boolean): Promise<void> {
  await requerirAdmin()
  await prismaMeta.paginaCms.update({ where: { slug }, data: { publicada } })
  revalidatePath("/")
  revalidatePath(`/superadmin/cms/${slug}`)
}

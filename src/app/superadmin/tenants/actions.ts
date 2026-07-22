"use server"

import { revalidatePath } from "next/cache"
import { provisionTenant } from "@/lib/provisioning/provision"
import { requerirAdmin } from "@/lib/dal"
import { prismaMeta } from "@/lib/prisma-meta"
import { MODULOS_CONTRATABLES } from "@/lib/modulos"

export interface ProvisionState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function provisionTenantAction(
  _prev: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  await requerirAdmin() // exige sesión de superadmin antes de tocar el control plane

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase()
  const nombre = String(formData.get("nombre") ?? "").trim()
  const tipoEntidad = String(formData.get("tipoEntidad") ?? "").trim()

  if (!slug || !nombre || !tipoEntidad) {
    return { ok: false, error: "Faltan campos: slug, nombre y tipo de entidad son obligatorios." }
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: "El slug solo admite minúsculas, números y guiones." }
  }

  try {
    const r = await provisionTenant({
      slug,
      nombre,
      tipoEntidad,
      dominioPrincipal: `${slug}.ossgovernmentone.lat`,
    })
    revalidatePath("/superadmin/tenants")
    return { ok: true, mensaje: `Tenant "${nombre}" provisionado (Neon ${r.neonProjectId}).` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al provisionar el tenant." }
  }
}

export interface ModulosState {
  ok?: boolean
  error?: string
}

/** Habilita/deshabilita los módulos CONTRATADOS de un tenant (solo módulos contratables). */
export async function actualizarModulosTenantAction(_prev: ModulosState, formData: FormData): Promise<ModulosState> {
  await requerirAdmin()
  const tenantId = String(formData.get("tenantId") ?? "").trim()
  if (!tenantId) return { ok: false, error: "Falta el tenant." }

  const validos = new Set(MODULOS_CONTRATABLES.map((m) => m.id))
  const modulos = formData.getAll("modulos").map(String).filter((m) => validos.has(m))

  try {
    await prismaMeta.tenant.update({ where: { id: tenantId }, data: { modulosContratados: modulos } })
    revalidatePath("/superadmin/tenants")
    return { ok: true }
  } catch {
    return { ok: false, error: "Error al actualizar los módulos." }
  }
}

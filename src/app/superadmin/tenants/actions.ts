"use server"

import { revalidatePath } from "next/cache"
import { provisionTenant } from "@/lib/provisioning/provision"
import { requerirAdmin } from "@/lib/dal"

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

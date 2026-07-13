// provision.ts — Orquesta el alta de un tenant: registro en la meta-DB → crear su BD
// Neon dedicada → guardar connection strings CIFRADAS. Con rollback si algo falla.
// (Aplicar el schema del tenant se hará cuando exista la fundación de dominio.)
import { prismaMeta } from "@/lib/prisma-meta"
import { encrypt } from "@/lib/encryption"
import { createNeonProject, deleteNeonProject } from "./neon"
import { applyTenantSchema } from "./schema-apply"

export interface ProvisionTenantInput {
  slug: string
  nombre: string
  tipoEntidad: string
  dominioPrincipal: string
  dominioPersonalizado?: string | null
}

export interface ProvisionResult {
  tenantId: string
  neonProjectId: string
  databaseName: string
}

export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionResult> {
  // 1. Registro en la meta-DB en estado CREANDO_NEON.
  const tenant = await prismaMeta.tenant.create({
    data: {
      slug: input.slug,
      nombre: input.nombre,
      tipoEntidad: input.tipoEntidad,
      dominioPrincipal: input.dominioPrincipal,
      dominioPersonalizado: input.dominioPersonalizado ?? null,
      estadoProvision: "CREANDO_NEON",
    },
  })

  let neonProjectId = ""
  try {
    // 2. Crear proyecto Neon (BD dedicada por tenant, aislamiento total).
    const neon = await createNeonProject(`gov1-${input.slug}`)
    neonProjectId = neon.projectId

    // 3. Guardar connStrings CIFRADAS + neonProjectId. Estado → APLICANDO_SCHEMA.
    await prismaMeta.tenant.update({
      where: { id: tenant.id },
      data: {
        neonProjectId: neon.projectId,
        databaseUrl: encrypt(neon.pooledUrl),
        databaseUrlDirect: encrypt(neon.directUrl),
        estadoProvision: "APLICANDO_SCHEMA",
      },
    })

    // 4. Aplicar el schema del tenant (fundación de dominio) a su BD → ACTIVO.
    await applyTenantSchema(neon.directUrl)
    await prismaMeta.tenant.update({
      where: { id: tenant.id },
      data: { estadoProvision: "ACTIVO", schemaVersion: 1 },
    })

    return { tenantId: tenant.id, neonProjectId: neon.projectId, databaseName: neon.databaseName }
  } catch (err) {
    // Rollback: borrar el proyecto Neon (si se creó) y marcar el registro FALLIDO.
    await deleteNeonProject(neonProjectId)
    await prismaMeta.tenant
      .update({ where: { id: tenant.id }, data: { estadoProvision: "FALLIDO", activo: false } })
      .catch(() => null)
    throw err
  }
}

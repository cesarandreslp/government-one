// provision.ts — Orquesta el alta de un tenant: registro en la meta-DB → crear su BD
// Neon dedicada → guardar connection strings CIFRADAS → aplicar schema → sembrar estructura
// base (plantilla por tipo de entidad) → crear el admin inicial (sin contraseña, la fija el
// superadmin aparte con scripts/seed-usuario-tenant.ts — nunca una contraseña puesta por
// código). Con rollback si algo falla.
import { prismaMeta } from "@/lib/prisma-meta"
import { encrypt } from "@/lib/encryption"
import { createNeonProject, deleteNeonProject } from "./neon"
import { applyTenantSchema } from "./schema-apply"
import { tenantClientDesde } from "@/lib/tenant-db"
import { aplicarPlantilla, hayPlantilla } from "@/lib/dominio/plantillas-cargo"

export interface ProvisionTenantInput {
  slug: string
  nombre: string
  tipoEntidad: string
  dominioPrincipal: string
  dominioPersonalizado?: string | null
  adminNombre: string
  adminApellido: string
  adminEmail: string
}

export interface ProvisionResult {
  tenantId: string
  neonProjectId: string
  databaseName: string
  estructuraSembrada: boolean
  dependencias: number
  cargos: number
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

    // 4. Aplicar el schema del tenant (fundación de dominio) a su BD.
    await applyTenantSchema(neon.directUrl)

    // 5. Sembrar la estructura base (dependencias + cargos) por tipo de entidad, y crear el
    // admin inicial — SIN contraseña (Usuario.passwordHash queda null; se fija aparte con
    // scripts/seed-usuario-tenant.ts, mismo patrón de credenciales que el resto de la
    // plataforma). Si el tipo de entidad no tiene plantilla todavía, no falla el
    // aprovisionamiento — el admin puede construir la estructura a mano desde /admin/estructura.
    const db = tenantClientDesde(neon.pooledUrl)
    let dependencias = 0
    let cargos = 0
    const estructuraSembrada = hayPlantilla(input.tipoEntidad)
    try {
      if (estructuraSembrada) {
        const r = await aplicarPlantilla(db, input.tipoEntidad)
        dependencias = r.dependencias
        cargos = r.cargos
      }
      await db.usuario.create({
        data: { email: input.adminEmail, nombre: input.adminNombre, apellido: input.adminApellido, rol: "SUPER_ADMIN" },
      })
    } finally {
      await db.$disconnect()
    }

    // 6. Todo listo → ACTIVO.
    await prismaMeta.tenant.update({
      where: { id: tenant.id },
      data: { estadoProvision: "ACTIVO", schemaVersion: 1 },
    })

    return { tenantId: tenant.id, neonProjectId: neon.projectId, databaseName: neon.databaseName, estructuraSembrada, dependencias, cargos }
  } catch (err) {
    // Rollback: borrar el proyecto Neon (si se creó) y marcar el registro FALLIDO.
    await deleteNeonProject(neonProjectId)
    await prismaMeta.tenant
      .update({ where: { id: tenant.id }, data: { estadoProvision: "FALLIDO", activo: false } })
      .catch(() => null)
    throw err
  }
}

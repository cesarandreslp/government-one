// Elimina un tenant: borra su proyecto Neon dedicado y su registro en la meta-DB.
// DESTRUCTIVO: borra la BD del tenant. Úsese solo para tenants de prueba.
//   TENANT_SLUG  slug del tenant a borrar
// Uso:  npx tsx scripts/delete-tenant.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { deleteNeonProject } from "../src/lib/provisioning/neon"

async function main() {
  const slug = process.env.TENANT_SLUG?.trim().toLowerCase()
  if (!slug) {
    console.error("Falta TENANT_SLUG en el entorno.")
    process.exit(1)
  }
  const t = await prismaMeta.tenant.findUnique({ where: { slug } })
  if (!t) {
    console.error(`No existe un tenant con slug "${slug}".`)
    process.exit(1)
  }
  if (t.neonProjectId) {
    await deleteNeonProject(t.neonProjectId)
    console.log(`  ✔ Proyecto Neon ${t.neonProjectId} borrado.`)
  }
  await prismaMeta.tenant.delete({ where: { id: t.id } })
  console.log(`✔ Tenant "${slug}" eliminado de la meta-DB.`)
  await prismaMeta.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

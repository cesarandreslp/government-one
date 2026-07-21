// Asigna (o limpia) el dominioPersonalizado de un tenant en la meta-DB. Útil para apuntar un
// tenant a un host concreto (ej. verificar en la URL de Vercel antes de tener subdominios reales).
//   TENANT_SLUG                 slug del tenant (ej. "demo")
//   TENANT_DOMINIO_PERSONALIZADO  host a asignar; vacío/"null" = limpiar
// Uso:  npx tsx scripts/set-tenant-host.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"

async function main() {
  const slug = process.env.TENANT_SLUG?.trim().toLowerCase()
  const raw = process.env.TENANT_DOMINIO_PERSONALIZADO?.trim()
  const dominio = !raw || raw.toLowerCase() === "null" ? null : raw.toLowerCase()

  if (!slug) {
    console.error("Falta TENANT_SLUG en el entorno.")
    process.exit(1)
  }

  const t = await prismaMeta.tenant.update({
    where: { slug },
    data: { dominioPersonalizado: dominio },
  })
  console.log(`✔ Tenant "${t.slug}": dominioPersonalizado = ${t.dominioPersonalizado ?? "(ninguno)"}.`)
  await prismaMeta.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

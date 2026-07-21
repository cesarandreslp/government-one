// Provisiona un tenant nuevo (crea su BD Neon dedicada + aplica el schema). El subdominio
// <slug>.ossgovernmentone.lat resuelve automáticamente por el WILDCARD atado a government-one.
//   TENANT_SLUG    slug (minúsculas/números/guiones)
//   TENANT_NOMBRE  nombre visible de la entidad
//   TENANT_TIPO    tipo de entidad (ALCALDIA | PERSONERIA | …); default ALCALDIA
// Uso:  npx tsx scripts/provision-tenant.ts
import "dotenv/config"
import { provisionTenant } from "../src/lib/provisioning/provision"
import { prismaMeta } from "../src/lib/prisma-meta"

async function main() {
  const slug = process.env.TENANT_SLUG?.trim().toLowerCase()
  const nombre = process.env.TENANT_NOMBRE?.trim()
  const tipoEntidad = process.env.TENANT_TIPO?.trim().toUpperCase() || "ALCALDIA"
  if (!slug || !nombre) {
    console.error("Falta TENANT_SLUG y/o TENANT_NOMBRE en el entorno.")
    process.exit(1)
  }
  const existe = await prismaMeta.tenant.findUnique({ where: { slug } })
  if (existe) {
    console.error(`Ya existe un tenant con slug "${slug}" (estado ${existe.estadoProvision}).`)
    process.exit(1)
  }

  console.log(`Provisionando "${nombre}" (${tipoEntidad}) — crea proyecto Neon REAL…`)
  const r = await provisionTenant({
    slug,
    nombre,
    tipoEntidad,
    dominioPrincipal: `${slug}.ossgovernmentone.lat`,
  })
  console.log(`✅ Provisionado: tenantId=${r.tenantId} · neon=${r.neonProjectId}`)
  console.log(`   URL del tenant: https://${slug}.ossgovernmentone.lat/ingresar (resuelve por el wildcard).`)
  await prismaMeta.$disconnect()
}

main().catch((e) => {
  console.error("❌ Falló:", e)
  process.exit(1)
})

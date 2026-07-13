import "dotenv/config"
import { provisionTenant } from "../src/lib/provisioning/provision"
import { prismaMeta } from "../src/lib/prisma-meta"
import { decrypt } from "../src/lib/encryption"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

async function main() {
  const slug = "demo"
  let t = await prismaMeta.tenant.findUnique({ where: { slug } })
  if (t) {
    console.log(`Tenant '${slug}' ya existe (estado=${t.estadoProvision}). No se recrea.`)
  } else {
    console.log("Provisionando tenant demo (crea proyecto Neon REAL)...")
    const r = await provisionTenant({
      slug, nombre: "Alcaldía Demo", tipoEntidad: "ALCALDIA",
      dominioPrincipal: "demo.ossgovernmentone.lat",
    })
    console.log("✅ Provisionado:", r)
    t = await prismaMeta.tenant.findUnique({ where: { id: r.tenantId } })
  }
  console.log("  registro meta-DB → neonProjectId:", t!.neonProjectId, "| estado:", t!.estadoProvision)
  console.log("  databaseUrl cifrada:", t!.databaseUrl?.slice(0, 24), "…")
  // Verificar: descifrar y conectar a la BD del tenant
  const directUrl = decrypt(t!.databaseUrlDirect!)
  const adapter = new PrismaPg({ connectionString: directUrl })
  const tenantDb = new PrismaClient({ adapter })
  const rows = await tenantDb.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`
  console.log("✅ Conexión a la BD del tenant demo OK (SELECT 1 =", rows[0].ok, ")")
  await tenantDb.$disconnect(); await prismaMeta.$disconnect()
}
main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

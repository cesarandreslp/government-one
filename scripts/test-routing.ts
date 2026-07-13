import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { decrypt } from "../src/lib/encryption"
import { applyTenantSchema } from "../src/lib/provisioning/schema-apply"
import { getTenantPrisma } from "../src/lib/tenant-db"

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo (correr test-provision primero)")

  if (demo.estadoProvision !== "ACTIVO") {
    console.log(`Aplicando schema del tenant a la BD demo (estado actual: ${demo.estadoProvision})...`)
    await applyTenantSchema(decrypt(demo.databaseUrlDirect!))
    await prismaMeta.tenant.update({ where: { id: demo.id }, data: { estadoProvision: "ACTIVO", schemaVersion: 1 } })
    console.log("✅ schema aplicado → tenant demo ACTIVO")
  } else {
    console.log("tenant demo ya ACTIVO")
  }

  const host = demo.dominioPrincipal // demo.ossgovernmentone.lat
  console.log(`\nRuteo: getTenantPrisma("${host}") …`)
  const db = await getTenantPrisma(host)
  if (!db) throw new Error("getTenantPrisma devolvió null (no ruteó)")

  const antes = await db.dependencia.count()
  await db.dependencia.upsert({
    where: { codigo: "SEC-01" },
    create: { codigo: "SEC-01", nombre: "Secretaría de Planeación", tipo: "SECRETARIA" },
    update: {},
  })
  const despues = await db.dependencia.count()
  console.log(`✅ Ruteo + BD del tenant OK: dependencias antes=${antes}, después=${despues}`)
  console.log(`   (escritura real en la BD PROPIA del tenant demo vía su subdominio)`) 
  await db.$disconnect()
  await prismaMeta.$disconnect()
}
main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

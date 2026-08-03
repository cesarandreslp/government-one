// Reaplica la plantilla de cargos del tenant demo (idempotente): usa esto cuando cambia
// `esServicioCompartido` u otro campo de la plantilla y hay que propagarlo a un tenant ya
// sembrado. Uso: npx tsx scripts/reaplicar-plantilla.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { getTenantPrisma } from "../src/lib/tenant-db"
import { aplicarPlantilla } from "../src/lib/dominio/plantillas-cargo"

async function main() {
  const demo = await prismaMeta.tenant.findUnique({ where: { slug: "demo" } })
  if (!demo) throw new Error("no hay tenant demo")
  const db = await getTenantPrisma(demo.dominioPrincipal)
  if (!db) throw new Error("getTenantPrisma devolvió null")

  const r = await aplicarPlantilla(db, demo.tipoEntidad)
  console.log(`Estructura reaplicada: ${r.dependencias} dependencias, ${r.cargos} cargos nuevos.`)

  const planBp = await db.dependencia.findUnique({ where: { codigo: "PLAN-BP" } })
  console.log(`PLAN-BP esServicioCompartido = ${planBp?.esServicioCompartido}`)

  await db.$disconnect()
  await prismaMeta.$disconnect()
}
main().catch((e) => { console.error("❌ Falló:", e); process.exit(1) })

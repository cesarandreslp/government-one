// Habilita los módulos CONTRATADOS de un tenant en la meta-DB (lo que hace el superadmin desde su
// UI). Los módulos base están siempre disponibles y no se listan aquí.
//   TENANT_SLUG      slug del tenant
//   TENANT_MODULOS   lista separada por comas de moduloId (ej. "contabilidad,presupuesto")
// Uso:  npx tsx scripts/set-tenant-modulos.ts
import "dotenv/config"
import { prismaMeta } from "../src/lib/prisma-meta"
import { MODULOS_CONTRATABLES } from "../src/lib/modulos"

async function main() {
  const slug = process.env.TENANT_SLUG?.trim().toLowerCase()
  const raw = process.env.TENANT_MODULOS?.trim() ?? ""
  if (!slug) {
    console.error("Falta TENANT_SLUG en el entorno.")
    process.exit(1)
  }
  const validos = new Set(MODULOS_CONTRATABLES.map((m) => m.id))
  const modulos = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const invalidos = modulos.filter((m) => !validos.has(m))
  if (invalidos.length) {
    console.error(`Módulos no contratables/desconocidos: ${invalidos.join(", ")}. Válidos: ${[...validos].join(", ")}`)
    process.exit(1)
  }

  const t = await prismaMeta.tenant.update({ where: { slug }, data: { modulosContratados: modulos } })
  console.log(`✔ Tenant "${t.slug}": módulos contratados = [${modulos.join(", ")}]`)
  await prismaMeta.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

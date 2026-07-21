// Migración controlada (interina, hasta que exista el orquestador de migraciones fan-out):
// agrega la columna `usuarios.passwordHash` a TODOS los tenants ACTIVO. Idempotente
// (`ADD COLUMN IF NOT EXISTS`). Recorre la meta-DB, descifra la connString DIRECTA de cada
// tenant y ejecuta el ALTER contra su BD Neon.
// Uso:  npx tsx scripts/migrate-usuario-passwordhash.ts
import "dotenv/config"
import { Client } from "pg"
import { prismaMeta } from "../src/lib/prisma-meta"
import { decrypt } from "../src/lib/encryption"

const DDL = 'ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT'

async function main() {
  const tenants = await prismaMeta.tenant.findMany({
    where: { estadoProvision: "ACTIVO" },
    select: { id: true, slug: true, databaseUrlDirect: true },
  })
  console.log(`Tenants ACTIVO: ${tenants.length}`)

  for (const t of tenants) {
    if (!t.databaseUrlDirect) {
      console.warn(`  ⚠ ${t.slug}: sin databaseUrlDirect, se omite.`)
      continue
    }
    const client = new Client({ connectionString: decrypt(t.databaseUrlDirect) })
    try {
      await client.connect()
      await client.query(DDL)
      console.log(`  ✔ ${t.slug}: columna passwordHash asegurada.`)
    } catch (e) {
      console.error(`  ✗ ${t.slug}: ${e instanceof Error ? e.message : e}`)
    } finally {
      await client.end().catch(() => null)
    }
  }
  await prismaMeta.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

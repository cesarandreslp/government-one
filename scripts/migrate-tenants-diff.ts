// Migrador INTERINO de tenants (fan-out controlado, hasta el orquestador de migraciones formal).
// Para cada tenant ACTIVO: calcula el diff entre SU BD y el schema objetivo del tenant
// (`prisma/tenant/schema.prisma`) con `prisma migrate diff`, y aplica el delta si no es vacío.
// El diff se hace apuntando `POSTGRES_URL_NON_POOLING` (que lee prisma.config.ts) a la BD directa
// del tenant; dotenv NO sobreescribe env ya presente, así que el override del hijo gana.
// Uso:  npx tsx scripts/migrate-tenants-diff.ts        (aplica)
//       DRY_RUN=1 npx tsx scripts/migrate-tenants-diff.ts   (solo muestra el SQL)
import "dotenv/config"
import { execFileSync } from "node:child_process"
import { Client } from "pg"
import { prismaMeta } from "../src/lib/prisma-meta"
import { decrypt } from "../src/lib/encryption"

function diffSql(directUrl: string): string {
  const out = execFileSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/tenant/schema.prisma", "--script"],
    { encoding: "utf8", env: { ...process.env, POSTGRES_URL_NON_POOLING: directUrl }, shell: true },
  )
  return out
}

function tieneCambios(sql: string): boolean {
  return /CREATE TABLE|ALTER TABLE|CREATE TYPE|CREATE INDEX|CREATE UNIQUE/i.test(sql)
}

async function main() {
  const dry = process.env.DRY_RUN === "1"
  const tenants = await prismaMeta.tenant.findMany({
    where: { estadoProvision: "ACTIVO" },
    select: { id: true, slug: true, databaseUrlDirect: true, schemaVersion: true },
  })
  console.log(`Tenants ACTIVO: ${tenants.length}${dry ? " (DRY RUN)" : ""}`)

  for (const t of tenants) {
    if (!t.databaseUrlDirect) {
      console.warn(`  ⚠ ${t.slug}: sin databaseUrlDirect, se omite.`)
      continue
    }
    const directUrl = decrypt(t.databaseUrlDirect)
    let sql = ""
    try {
      sql = diffSql(directUrl)
    } catch (e) {
      console.error(`  ✗ ${t.slug}: error calculando diff: ${e instanceof Error ? e.message : e}`)
      continue
    }

    if (!tieneCambios(sql)) {
      console.log(`  = ${t.slug}: al día (sin cambios).`)
      continue
    }
    if (dry) {
      console.log(`  ~ ${t.slug}: cambios pendientes:\n${sql}`)
      continue
    }

    const client = new Client({ connectionString: directUrl })
    try {
      await client.connect()
      await client.query(sql)
      console.log(`  ✔ ${t.slug}: delta aplicado.`)
    } catch (e) {
      console.error(`  ✗ ${t.slug}: error aplicando delta: ${e instanceof Error ? e.message : e}`)
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

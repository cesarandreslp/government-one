// schema-apply.ts — Aplica el schema del tenant (prisma/tenant/provision-schema.sql)
// a la BD de un tenant. Se ejecuta con la connection string DIRECTA (non-pooling).
// Patrón del control plane: el schema del tenant se materializa como SQL versionable
// y se aplica por-tenant (aquí en el alta; el orquestador de migraciones lo hará para
// cambios posteriores). Idempotencia futura vía migraciones versionadas.
import { Client } from "pg"
import { readFileSync } from "node:fs"
import { join } from "node:path"

export function tenantSchemaSql(): string {
  return readFileSync(join(process.cwd(), "prisma", "tenant", "provision-schema.sql"), "utf8")
}

/** Ejecuta el DDL del tenant contra su BD (connString directa). */
export async function applyTenantSchema(directUrl: string): Promise<void> {
  const sql = tenantSchemaSql()
  const client = new Client({ connectionString: directUrl })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

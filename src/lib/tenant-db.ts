// tenant-db.ts — Ruteo de tenant: resuelve el tenant por HOST (subdominio gestionado o
// dominio propio) desde la meta-DB, descifra su connection string y crea un cliente
// Prisma apuntando a la BD del tenant. Base del multi-tenant en runtime.
import { PrismaClient } from "@/generated/tenant/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { prismaMeta } from "@/lib/prisma-meta"
import { decrypt } from "@/lib/encryption"

/** Crea un cliente Prisma del tenant a partir de su connString pooled (ya descifrada). */
export function tenantClientDesde(connStringPooled: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: connStringPooled })
  return new PrismaClient({ adapter })
}

/** Resuelve el tenant por host: subdominio gestionado (`dominioPrincipal`) O dominio propio. */
export async function resolveTenantByHost(host: string) {
  const h = host.toLowerCase().split(":")[0]
  return prismaMeta.tenant.findFirst({
    where: {
      activo: true,
      OR: [{ dominioPrincipal: h }, { dominioPersonalizado: h }],
    },
  })
}

/**
 * Cliente Prisma de la BD del tenant que corresponde a `host`. `null` si el host no mapea
 * a ningún tenant activo con BD lista. (Cache de clientes por-tenant: pendiente para escala.)
 */
export async function getTenantPrisma(host: string): Promise<PrismaClient | null> {
  const tenant = await resolveTenantByHost(host)
  if (!tenant?.databaseUrl) return null
  return tenantClientDesde(decrypt(tenant.databaseUrl))
}

import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { resolveTenantByHost, tenantClientDesde } from "@/lib/tenant-db"
import { prismaMeta } from "@/lib/prisma-meta"
import { decrypt } from "@/lib/encryption"
import type { PrismaClient } from "@/generated/tenant/client"

// Contexto de TENANT resuelto por HOST del request. Es la puerta de entrada de todo lo
// tenant-facing (login del funcionario, /admin/*, y a futuro el portal público). Devuelve el
// registro del tenant (meta-DB) + un cliente Prisma apuntando a SU BD.
//
// Override de DESARROLLO: en local (localhost) no hay subdominio de tenant real, así que si
// DEV_TENANT_SLUG está definido y no estamos en producción, se resuelve ese tenant por slug.
// En producción SIEMPRE se resuelve por host (nunca por el override).

export interface ContextoTenant {
  tenant: {
    id: string
    slug: string
    nombre: string
    tipoEntidad: string
    dominioPrincipal: string
    /** Módulos contratados (habilitados por el superadmin). Los base están siempre disponibles. */
    modulosContratados: string[]
  }
  db: PrismaClient
}

function esHostLocal(host: string): boolean {
  const h = host.toLowerCase()
  return h.startsWith("localhost") || h.startsWith("127.0.0.1") || h.startsWith("[::1]")
}

/** Resuelve el tenant del request actual (o null si el host no mapea a ninguno). Cacheado por render. */
export const contextoTenant = cache(async (): Promise<ContextoTenant | null> => {
  const host = (await headers()).get("host") ?? ""

  let tenant = null
  if (process.env.NODE_ENV !== "production" && process.env.DEV_TENANT_SLUG && esHostLocal(host)) {
    tenant = await prismaMeta.tenant.findFirst({
      where: { slug: process.env.DEV_TENANT_SLUG.toLowerCase(), activo: true },
    })
  } else {
    tenant = await resolveTenantByHost(host)
  }

  if (!tenant?.databaseUrl) return null
  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      nombre: tenant.nombre,
      tipoEntidad: tenant.tipoEntidad,
      dominioPrincipal: tenant.dominioPrincipal,
      modulosContratados: Array.isArray(tenant.modulosContratados) ? (tenant.modulosContratados as string[]) : [],
    },
    db: tenantClientDesde(decrypt(tenant.databaseUrl)),
  }
})

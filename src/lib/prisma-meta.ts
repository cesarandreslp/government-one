// Cliente de la meta-DB (control plane) — el directorio de la flota multi-tenant.
// Prisma 7: el cliente nuevo requiere un driver adapter (no hay datasourceUrl).
// Runtime: conexión POOLED de Neon (DATABASE_URL), apta para serverless.
// En Vercel las env vars vienen de la integración Neon; en local de .env(.local).
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.DATABASE_URL

const globalForPrisma = globalThis as unknown as { prismaMeta?: PrismaClient }

function crearPrismaMeta(): PrismaClient {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

// Singleton (evita agotar conexiones en dev con hot-reload).
export const prismaMeta: PrismaClient = globalForPrisma.prismaMeta ?? crearPrismaMeta()

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaMeta = prismaMeta

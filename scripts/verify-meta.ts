// Verificación en vivo de la meta-DB Neon: cuenta tenants (debe dar 0 tras la 1ª migración).
// Prueba end-to-end del cliente Prisma 7 + adapter pg + conexión pooled a Neon.
// Uso: npx tsx scripts/verify-meta.ts
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  const count = await prisma.tenant.count()
  console.log(`✅ Conexión viva a la meta-DB Neon OK. tenants = ${count}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("❌ Falló la verificación:", e)
  process.exit(1)
})

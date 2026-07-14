// Crea (o actualiza la contraseña de) el superadmin de plataforma inicial.
// Lee las credenciales de variables de entorno para NO ponerlas en el código ni en la CLI:
//   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD  (y opcional SUPERADMIN_NOMBRE)
// Uso:  npx tsx scripts/seed-admin.ts
// Recomendación: tras correrlo, borra SUPERADMIN_PASSWORD de .env.
import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

async function main() {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SUPERADMIN_PASSWORD
  const nombre = process.env.SUPERADMIN_NOMBRE?.trim() || "Superadmin"

  if (!email || !password) {
    console.error("Falta SUPERADMIN_EMAIL y/o SUPERADMIN_PASSWORD en el entorno (.env).")
    process.exit(1)
  }
  if (password.length < 10) {
    console.error("SUPERADMIN_PASSWORD debe tener al menos 10 caracteres.")
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const admin = await prisma.adminPlataforma.upsert({
    where: { email },
    update: { passwordHash, activo: true, nombre },
    create: { email, nombre, passwordHash },
  })

  console.log(`✔ Superadmin listo: ${admin.email} (id ${admin.id}). Recuerda borrar SUPERADMIN_PASSWORD de .env.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

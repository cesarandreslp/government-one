// Verificación en vivo del auth de plataforma (sin teclear contraseñas en UI):
// crea un admin de prueba efímero, valida contraseña correcta/incorrecta (bcrypt),
// hace roundtrip de firma/verificación de sesión (jose), y borra el admin de prueba.
// Uso: npx tsx scripts/verify-auth.ts
import "dotenv/config"
import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const email = `__verify_${Date.now()}@example.test`
  const password = require("crypto").randomBytes(16).toString("hex")
  const hash = await bcrypt.hash(password, 12)

  const admin = await prisma.adminPlataforma.create({
    data: { email, nombre: "Verify", passwordHash: hash },
  })

  const okBien = await bcrypt.compare(password, admin.passwordHash)
  const okMal = await bcrypt.compare("password-incorrecta", admin.passwordHash)

  // jose roundtrip con SESSION_SECRET real
  const key = new TextEncoder().encode(process.env.SESSION_SECRET)
  const token = await new SignJWT({ adminId: admin.id, email: admin.email, nombre: admin.nombre })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 60000))
    .sign(key)
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] })
  const tokenMalo = await jwtVerify(token, new TextEncoder().encode("clave-equivocada"), {
    algorithms: ["HS256"],
  }).then(() => true).catch(() => false)

  await prisma.adminPlataforma.delete({ where: { id: admin.id } })
  const quedan = await prisma.adminPlataforma.count()

  console.log("compare(correcta) =", okBien, "(esperado true)")
  console.log("compare(incorrecta) =", okMal, "(esperado false)")
  console.log("jwt payload.adminId ==", payload.adminId === admin.id, "(esperado true)")
  console.log("jwt con clave equivocada verifica =", tokenMalo, "(esperado false)")
  console.log("admins tras limpiar =", quedan)

  const pass = okBien && !okMal && payload.adminId === admin.id && tokenMalo === false
  console.log(pass ? "✅ AUTH OK" : "❌ AUTH FALLÓ")
  await prisma.$disconnect()
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

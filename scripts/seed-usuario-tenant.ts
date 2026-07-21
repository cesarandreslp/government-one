// Crea (o actualiza la contraseña de) el FUNCIONARIO ADMIN inicial de un tenant, para poder
// entrar al admin del tenant (/admin) y desde ahí sembrar la estructura y crear más usuarios.
// Igual que el superadmin de plataforma: credenciales por variables de entorno, NUNCA en código.
//   TENANT_SLUG        slug del tenant (ej. "demo")
//   TENANT_USER_EMAIL  correo del funcionario
//   TENANT_USER_PASSWORD  contraseña (≥10 chars)
//   TENANT_USER_NOMBRE / TENANT_USER_APELLIDO  (opcionales)
//   TENANT_USER_ROL    SUPER_ADMIN | ADMIN  (default SUPER_ADMIN)
// Uso:  npx tsx scripts/seed-usuario-tenant.ts
// Recomendación: tras correrlo, borra TENANT_USER_PASSWORD de .env.
import "dotenv/config"
import bcrypt from "bcryptjs"
import { prismaMeta } from "../src/lib/prisma-meta"
import { decrypt } from "../src/lib/encryption"
import { tenantClientDesde } from "../src/lib/tenant-db"

async function main() {
  const slug = process.env.TENANT_SLUG?.trim().toLowerCase()
  const email = process.env.TENANT_USER_EMAIL?.trim().toLowerCase()
  const password = process.env.TENANT_USER_PASSWORD
  const nombre = process.env.TENANT_USER_NOMBRE?.trim() || "Administrador"
  const apellido = process.env.TENANT_USER_APELLIDO?.trim() || "de la Entidad"
  const rol = (process.env.TENANT_USER_ROL?.trim().toUpperCase() as "SUPER_ADMIN" | "ADMIN") || "SUPER_ADMIN"

  if (!slug || !email || !password) {
    console.error("Falta TENANT_SLUG, TENANT_USER_EMAIL y/o TENANT_USER_PASSWORD en el entorno (.env).")
    process.exit(1)
  }
  if (password.length < 10) {
    console.error("TENANT_USER_PASSWORD debe tener al menos 10 caracteres.")
    process.exit(1)
  }
  if (rol !== "SUPER_ADMIN" && rol !== "ADMIN") {
    console.error("TENANT_USER_ROL debe ser SUPER_ADMIN o ADMIN.")
    process.exit(1)
  }

  const tenant = await prismaMeta.tenant.findUnique({ where: { slug } })
  if (!tenant) {
    console.error(`No existe un tenant con slug "${slug}".`)
    process.exit(1)
  }
  if (!tenant.databaseUrl) {
    console.error(`El tenant "${slug}" no tiene databaseUrl (¿provisionamiento incompleto?).`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const db = tenantClientDesde(decrypt(tenant.databaseUrl))

  const u = await db.usuario.upsert({
    where: { email },
    update: { passwordHash, activo: true, nombre, apellido, rol },
    create: { email, nombre, apellido, rol, passwordHash },
  })

  console.log(`✔ Funcionario ${rol} listo en tenant "${slug}": ${u.email} (id ${u.id}).`)
  console.log("  Recuerda borrar TENANT_USER_PASSWORD de .env.")
  await db.$disconnect()
  await prismaMeta.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

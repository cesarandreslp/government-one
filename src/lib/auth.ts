import "server-only"
import bcrypt from "bcryptjs"
import { prismaMeta } from "@/lib/prisma-meta"
import type { SessionPayload } from "@/lib/session"

// Autenticación del superadmin de PLATAFORMA contra la meta-DB.
// Las contraseñas se guardan SOLO como hash bcrypt; la verificación compara en el servidor.

const ROUNDS = 12

export async function hashearPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, ROUNDS)
}

/**
 * Verifica email + contraseña contra `admins_plataforma`. Devuelve los datos del admin
 * si coinciden y está activo; `null` en cualquier otro caso (sin filtrar por qué falló).
 * Registra `ultimoIngreso` en el login exitoso.
 */
export async function verificarCredenciales(
  email: string,
  password: string,
): Promise<SessionPayload | null> {
  const admin = await prismaMeta.adminPlataforma.findUnique({
    where: { email: email.trim().toLowerCase() },
  })
  if (!admin || !admin.activo) {
    // Comparación señuelo para no revelar por temporización si el email existe.
    await bcrypt.compare(password, "$2a$12$0000000000000000000000000000000000000000000000000000")
    return null
  }
  const ok = await bcrypt.compare(password, admin.passwordHash)
  if (!ok) return null

  await prismaMeta.adminPlataforma.update({
    where: { id: admin.id },
    data: { ultimoIngreso: new Date() },
  })
  return { adminId: admin.id, email: admin.email, nombre: admin.nombre }
}

import "server-only"
import bcrypt from "bcryptjs"
import type { PrismaClient } from "@/generated/tenant/client"

// Autenticación del FUNCIONARIO contra la BD de SU tenant (no la meta-DB). Las contraseñas
// se guardan SOLO como hash bcrypt en Usuario.passwordHash; la verificación compara en el
// servidor. `db` es el cliente Prisma del tenant resuelto por host (ver tenant-db.ts).

const ROUNDS = 12
// Hash señuelo para comparar siempre y no filtrar por temporización si el email no existe.
const SENUELO = "$2a$12$0000000000000000000000000000000000000000000000000000"

export async function hashearPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, ROUNDS)
}

export interface FuncionarioAutenticado {
  usuarioId: string
  email: string
  nombre: string
  rol: string
}

/**
 * Verifica email + contraseña contra la tabla `usuarios` del tenant. Devuelve los datos del
 * funcionario si coinciden, está activo y tiene contraseña fijada; `null` en cualquier otro
 * caso (sin revelar cuál falló). No incluye `tenantId`: lo agrega el llamador con el contexto.
 */
export async function verificarCredencialesTenant(
  db: Pick<PrismaClient, "usuario">,
  email: string,
  password: string,
): Promise<FuncionarioAutenticado | null> {
  const u = await db.usuario.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!u || !u.activo || !u.passwordHash) {
    await bcrypt.compare(password, SENUELO) // comparación señuelo (temporización constante)
    return null
  }
  const ok = await bcrypt.compare(password, u.passwordHash)
  if (!ok) return null
  return { usuarioId: u.id, email: u.email, nombre: `${u.nombre} ${u.apellido}`.trim(), rol: u.rol }
}

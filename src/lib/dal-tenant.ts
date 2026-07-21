import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { contextoTenant, type ContextoTenant } from "@/lib/contexto-tenant"
import { leerSesionTenant } from "@/lib/tenant-session-cookies"
import type { TenantSessionPayload } from "@/lib/tenant-session"
import { tieneCapacidad } from "@/lib/dominio/acceso"

const ROLES_ADMIN_TENANT = ["ADMIN", "SUPER_ADMIN"]

// Data Access Layer del TENANT: cerradura de autorización cerca de los datos para /admin/*.
// Distinta del DAL de plataforma (dal.ts, que mira la sesión del superadmin en la meta-DB).

export interface ContextoFuncionario extends ContextoTenant {
  sesion: TenantSessionPayload
}

/**
 * Exige una sesión de funcionario VÁLIDA para el tenant del host actual. Redirige a /ingresar
 * si no hay tenant, no hay sesión, o la sesión es de OTRO tenant (defensa en profundidad: la
 * cookie ya es host-scoped, pero igual validamos `tenantId`). Devuelve tenant + db + sesión.
 */
export const requerirFuncionario = cache(async (): Promise<ContextoFuncionario> => {
  const ctx = await contextoTenant()
  if (!ctx) redirect("/ingresar")

  const sesion = await leerSesionTenant()
  if (!sesion || sesion.tenantId !== ctx.tenant.id) redirect("/ingresar")

  return { ...ctx, sesion }
})

/**
 * Exige que el funcionario tenga uno de los roles de IDENTIDAD indicados (administración del
 * tenant, ej. gestionar la estructura organizacional). No confundir con capacidades de módulo.
 */
export async function requerirRolTenant(roles: string[]): Promise<ContextoFuncionario> {
  const ctx = await requerirFuncionario()
  if (!roles.includes(ctx.sesion.rol)) redirect("/admin")
  return ctx
}

/**
 * ¿El funcionario puede ejecutar una CAPACIDAD de módulo? Los administradores del tenant
 * (ADMIN/SUPER_ADMIN) siempre pueden (administran la entidad); el resto necesita la capacidad
 * conferida por algún cargo vigente (fundación de dominio). Aquí se cablea `tieneCapacidad`.
 */
export async function funcionarioPuede(
  ctx: ContextoFuncionario,
  modulo: string,
  capacidad: string,
): Promise<boolean> {
  if (ROLES_ADMIN_TENANT.includes(ctx.sesion.rol)) return true
  return tieneCapacidad(ctx.db, ctx.sesion.usuarioId, modulo, capacidad)
}

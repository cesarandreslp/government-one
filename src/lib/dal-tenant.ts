import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { contextoTenant, type ContextoTenant } from "@/lib/contexto-tenant"
import { leerSesionTenant } from "@/lib/tenant-session-cookies"
import type { TenantSessionPayload } from "@/lib/tenant-session"
import { tieneCapacidad } from "@/lib/dominio/acceso"
import { moduloDisponible } from "@/lib/modulos"

export const ROLES_ADMIN_TENANT = ["ADMIN", "SUPER_ADMIN"]

/** ¿El módulo está asignado a alguna dependencia que el funcionario ejerce con vínculo vigente? */
async function moduloAsignadoAlFuncionario(
  ctx: ContextoFuncionario,
  modulo: string,
  ahora: Date = new Date(),
): Promise<boolean> {
  const vinculos = await ctx.db.vinculacionCargo.findMany({
    where: { usuarioId: ctx.sesion.usuarioId, desde: { lte: ahora }, OR: [{ hasta: null }, { hasta: { gte: ahora } }] },
    include: { cargo: { include: { dependencia: { select: { modulos: true } } } } },
  })
  return vinculos.some((v) => {
    const mods = v.cargo.dependencia.modulos
    return Array.isArray(mods) && (mods as string[]).includes(modulo)
  })
}

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
 * ¿El funcionario puede ejecutar una CAPACIDAD de módulo? Gobernanza en 3 capas:
 *   1. El módulo debe estar DISPONIBLE para el tenant (base o contratado por el superadmin) —
 *      aplica a TODOS, incluido el admin (nadie usa un módulo que la entidad no contrató).
 *   2. El módulo debe estar ASIGNADO a alguna dependencia que el funcionario ejerce.
 *   3. El cargo debe conferir la CAPACIDAD.
 * El admin del tenant (ADMIN/SUPER_ADMIN) omite las capas 2 y 3 (administra la entidad).
 */
export async function funcionarioPuede(
  ctx: ContextoFuncionario,
  modulo: string,
  capacidad: string,
): Promise<boolean> {
  // Capa 1 — módulo contratado/base (todos).
  if (!moduloDisponible(modulo, ctx.tenant.modulosContratados)) return false
  // Admin del tenant: omite capas 2 y 3.
  if (ROLES_ADMIN_TENANT.includes(ctx.sesion.rol)) return true
  // Capa 2 — asignado a su dependencia.
  if (!(await moduloAsignadoAlFuncionario(ctx, modulo))) return false
  // Capa 3 — capacidad del cargo.
  return tieneCapacidad(ctx.db, ctx.sesion.usuarioId, modulo, capacidad)
}

/**
 * Módulos que el funcionario puede VER en el nav (para mostrar solo lo pertinente). Admin del
 * tenant ve todos los DISPONIBLES; el resto, solo los disponibles asignados a su dependencia.
 */
export async function modulosVisibles(ctx: ContextoFuncionario, moduloIds: string[]): Promise<string[]> {
  const disponibles = moduloIds.filter((m) => moduloDisponible(m, ctx.tenant.modulosContratados))
  if (ROLES_ADMIN_TENANT.includes(ctx.sesion.rol)) return disponibles
  const out: string[] = []
  for (const m of disponibles) if (await moduloAsignadoAlFuncionario(ctx, m)) out.push(m)
  return out
}

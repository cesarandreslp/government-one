import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { contextoTenant, type ContextoTenant } from "@/lib/contexto-tenant"
import { leerSesionTenant } from "@/lib/tenant-session-cookies"
import type { TenantSessionPayload } from "@/lib/tenant-session"

// DAL del portal del CONTRATISTA (identidad externa, no ocupa cargo — ver RolUsuario en el
// schema). Comparte la MISMA sesión/cookie que el DAL de funcionarios (dal-tenant.ts) — la
// diferencia es que aquí el acceso no depende de capacidades vía cargo, sino de ser el `Tercero`
// dueño de un contrato (Usuario.terceroId). Nunca usar requerirFuncionario aquí: ese DAL no valida
// terceroId y dejaría pasar a cualquier funcionario sin cargo hasta el "sin acceso" de cada página.

export interface ContextoContratista extends ContextoTenant {
  sesion: TenantSessionPayload
  terceroId: string
}

export const requerirContratista = cache(async (): Promise<ContextoContratista> => {
  const ctx = await contextoTenant()
  if (!ctx) redirect("/ingresar")

  const sesion = await leerSesionTenant()
  if (!sesion) redirect("/ingresar")
  if (sesion.tenantId !== ctx.tenant.id) redirect("/salir-forzado")
  if (sesion.rol !== "CONTRATISTA") redirect("/admin")

  const usuario = await ctx.db.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { terceroId: true, activo: true } })
  if (!usuario?.activo || !usuario.terceroId) redirect("/ingresar")

  return { ...ctx, sesion, terceroId: usuario.terceroId }
})

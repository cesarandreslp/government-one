"use server"

import { redirect } from "next/navigation"
import { contextoTenant } from "@/lib/contexto-tenant"
import { verificarCredencialesTenant } from "@/lib/tenant-auth"
import { crearSesionTenant, borrarSesionTenant } from "@/lib/tenant-session-cookies"

export interface IngresarState {
  error?: string
}

export async function ingresarAction(_prev: IngresarState, formData: FormData): Promise<IngresarState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "/admin/estructura")

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." }
  }

  const ctx = await contextoTenant()
  if (!ctx) {
    return { error: "Esta dirección no corresponde a ninguna entidad activa." }
  }

  const funcionario = await verificarCredencialesTenant(ctx.db, email, password)
  if (!funcionario) {
    return { error: "Credenciales inválidas." }
  }

  await crearSesionTenant({ tenantId: ctx.tenant.id, ...funcionario })
  redirect(next.startsWith("/admin") ? next : "/admin/estructura")
}

export async function salirAction(): Promise<void> {
  await borrarSesionTenant()
  redirect("/ingresar")
}

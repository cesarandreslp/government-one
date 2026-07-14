"use server"

import { redirect } from "next/navigation"
import { verificarCredenciales } from "@/lib/auth"
import { crearSesion, borrarSesion } from "@/lib/session-cookies"

export interface LoginState {
  error?: string
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "/superadmin/tenants")

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." }
  }

  const admin = await verificarCredenciales(email, password)
  if (!admin) {
    return { error: "Credenciales inválidas." }
  }

  await crearSesion(admin)
  redirect(next.startsWith("/superadmin") ? next : "/superadmin/tenants")
}

export async function logoutAction(): Promise<void> {
  await borrarSesion()
  redirect("/login")
}

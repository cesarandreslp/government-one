import "server-only"
import { cookies } from "next/headers"
import {
  firmarSesionTenant,
  verificarSesionTenant,
  NOMBRE_COOKIE_TENANT,
  DURACION_SESION_TENANT_MS,
  type TenantSessionPayload,
} from "@/lib/tenant-session"

// Manejo de la cookie de sesión del funcionario del tenant (solo servidor: usa next/headers).

export async function crearSesionTenant(payload: TenantSessionPayload): Promise<void> {
  const expiraEn = new Date(Date.now() + DURACION_SESION_TENANT_MS)
  const token = await firmarSesionTenant(payload, expiraEn)
  const store = await cookies()
  store.set(NOMBRE_COOKIE_TENANT, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiraEn,
    path: "/",
  })
}

export async function leerSesionTenant(): Promise<TenantSessionPayload | null> {
  const store = await cookies()
  return verificarSesionTenant(store.get(NOMBRE_COOKIE_TENANT)?.value)
}

export async function borrarSesionTenant(): Promise<void> {
  const store = await cookies()
  store.delete(NOMBRE_COOKIE_TENANT)
}

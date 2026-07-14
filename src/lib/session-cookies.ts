import "server-only"
import { cookies } from "next/headers"
import {
  firmarSesion,
  verificarSesion,
  NOMBRE_COOKIE_SESION,
  DURACION_SESION_MS,
  type SessionPayload,
} from "@/lib/session"

// Manejo de la cookie de sesión (solo servidor: usa next/headers).

export async function crearSesion(payload: SessionPayload): Promise<void> {
  const expiraEn = new Date(Date.now() + DURACION_SESION_MS)
  const token = await firmarSesion(payload, expiraEn)
  const store = await cookies()
  store.set(NOMBRE_COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiraEn,
    path: "/",
  })
}

export async function leerSesion(): Promise<SessionPayload | null> {
  const store = await cookies()
  return verificarSesion(store.get(NOMBRE_COOKIE_SESION)?.value)
}

export async function borrarSesion(): Promise<void> {
  const store = await cookies()
  store.delete(NOMBRE_COOKIE_SESION)
}

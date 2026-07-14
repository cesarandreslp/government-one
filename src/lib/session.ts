import { SignJWT, jwtVerify } from "jose"

// Cripto de sesión del superadmin de PLATAFORMA (SaaS): firmar/verificar el JWT.
// SIN next/headers para poder usarse también desde el proxy (edge/node) sin arrastrar
// el runtime de request. El manejo de cookies vive en session-cookies.ts (solo servidor).

export const NOMBRE_COOKIE_SESION = "g1_session"
export const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000 // 7 días

export interface SessionPayload {
  adminId: string
  email: string
  nombre: string
  [key: string]: unknown
}

function claveCodificada(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("Falta SESSION_SECRET en el entorno.")
  return new TextEncoder().encode(secret)
}

export async function firmarSesion(payload: SessionPayload, expiraEn: Date): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiraEn)
    .sign(claveCodificada())
}

export async function verificarSesion(token?: string): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, claveCodificada(), { algorithms: ["HS256"] })
    return payload as SessionPayload
  } catch {
    return null
  }
}

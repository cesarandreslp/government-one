import { SignJWT, jwtVerify } from "jose"

// Cripto de sesión del FUNCIONARIO de un tenant. Distinta de la sesión del superadmin de
// plataforma (session.ts): esta ata la sesión a un tenant concreto (`tenantId`) además del
// usuario. SIN next/headers para poder usarse desde el proxy. La cookie vive en
// tenant-session-cookies.ts. Cookie con nombre propio para no colisionar con la de plataforma.

export const NOMBRE_COOKIE_TENANT = "g1t_session"
export const DURACION_SESION_TENANT_MS = 7 * 24 * 60 * 60 * 1000 // 7 días

export interface TenantSessionPayload {
  tenantId: string // ata la sesión a UN tenant (defensa: el DAL valida contra el host actual)
  usuarioId: string
  email: string
  nombre: string
  rol: string
  [key: string]: unknown
}

function claveCodificada(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("Falta SESSION_SECRET en el entorno.")
  return new TextEncoder().encode(secret)
}

export async function firmarSesionTenant(payload: TenantSessionPayload, expiraEn: Date): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiraEn)
    .sign(claveCodificada())
}

export async function verificarSesionTenant(token?: string): Promise<TenantSessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, claveCodificada(), { algorithms: ["HS256"] })
    if (!payload.tenantId || !payload.usuarioId) return null
    return payload as TenantSessionPayload
  } catch {
    return null
  }
}

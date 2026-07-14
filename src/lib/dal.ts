import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { leerSesion } from "@/lib/session-cookies"
import type { SessionPayload } from "@/lib/session"

// Data Access Layer: cerradura de autorización cerca de los datos (no solo en el proxy).
// `cache` memoiza la lectura de sesión dentro de un mismo render de React.

export const obtenerSesion = cache(async (): Promise<SessionPayload | null> => {
  return leerSesion()
})

/**
 * Exige sesión de superadmin. Si no hay, redirige a /login. Úsese en layouts/páginas y
 * al inicio de server actions del control plane.
 */
export const requerirAdmin = cache(async (): Promise<SessionPayload> => {
  const sesion = await obtenerSesion()
  if (!sesion?.adminId) redirect("/login")
  return sesion
})

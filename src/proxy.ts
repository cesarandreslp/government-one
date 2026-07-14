import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verificarSesion, NOMBRE_COOKIE_SESION } from "@/lib/session"

// Next 16: el antiguo `middleware` se renombró a `proxy`. Chequeo OPTIMISTA (solo lee la
// cookie firmada, sin tocar la BD) para pre-filtrar accesos y encaminar redirecciones.
// La cerradura real vive en el layout de /superadmin y en el DAL (requerirAdmin).

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(NOMBRE_COOKIE_SESION)?.value
  const sesion = await verificarSesion(token)

  const esSuperadmin = pathname.startsWith("/superadmin")
  const esLogin = pathname === "/login"

  if (esSuperadmin && !sesion?.adminId) {
    const url = new URL("/login", req.url)
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (esLogin && sesion?.adminId) {
    return NextResponse.redirect(new URL("/superadmin/tenants", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/superadmin/:path*", "/login"],
}

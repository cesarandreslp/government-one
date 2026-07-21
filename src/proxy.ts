import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verificarSesion, NOMBRE_COOKIE_SESION } from "@/lib/session"
import { verificarSesionTenant, NOMBRE_COOKIE_TENANT } from "@/lib/tenant-session"

// Next 16: el antiguo `middleware` se renombró a `proxy`. Chequeo OPTIMISTA (solo lee las
// cookies firmadas, sin tocar la BD) para pre-filtrar accesos. La cerradura real vive en los
// layouts + DAL: /superadmin (requerirAdmin, plataforma) y /admin (requerirFuncionario, tenant).

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Plataforma (superadmin) ──────────────────────────────────────────────
  if (pathname.startsWith("/superadmin") || pathname === "/login") {
    const sesion = await verificarSesion(req.cookies.get(NOMBRE_COOKIE_SESION)?.value)
    if (pathname.startsWith("/superadmin") && !sesion?.adminId) {
      const url = new URL("/login", req.url)
      url.searchParams.set("next", pathname)
      return NextResponse.redirect(url)
    }
    if (pathname === "/login" && sesion?.adminId) {
      return NextResponse.redirect(new URL("/superadmin/tenants", req.url))
    }
    return NextResponse.next()
  }

  // ── Tenant (funcionario) ─────────────────────────────────────────────────
  if (pathname.startsWith("/admin") || pathname === "/ingresar") {
    const sesion = await verificarSesionTenant(req.cookies.get(NOMBRE_COOKIE_TENANT)?.value)
    if (pathname.startsWith("/admin") && !sesion?.usuarioId) {
      const url = new URL("/ingresar", req.url)
      url.searchParams.set("next", pathname)
      return NextResponse.redirect(url)
    }
    if (pathname === "/ingresar" && sesion?.usuarioId) {
      return NextResponse.redirect(new URL("/admin/estructura", req.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/superadmin/:path*", "/login", "/admin/:path*", "/ingresar"],
}

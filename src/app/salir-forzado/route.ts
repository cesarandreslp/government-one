import { NextResponse } from "next/server"
import { borrarSesionTenant } from "@/lib/tenant-session-cookies"

// Ruta de escape para una sesión de tenant INVÁLIDA (ej. cookie de otro tenant, o de un tenant ya
// borrado): a diferencia de una página/layout, un Route Handler SÍ puede escribir cookies. Sin
// esto, `requerirFuncionario` redirigiendo directo a "/ingresar" con una cookie de sesión
// presente-pero-inválida entra en loop con el proxy (que solo valida la firma, no el tenant).
export async function GET(req: Request) {
  await borrarSesionTenant()
  return NextResponse.redirect(new URL("/ingresar", req.url))
}

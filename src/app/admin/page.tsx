import { redirect } from "next/navigation"
import { requerirFuncionario, modulosVisibles, ROLES_ADMIN_TENANT } from "@/lib/dal-tenant"
import { MODULOS } from "@/lib/modulos"

export const dynamic = "force-dynamic"

// La raíz del admin del tenant redirige a la primera sección disponible. El admin del tenant
// siempre va a Estructura; un funcionario no-admin va a su primer módulo visible — redirigirlo
// también a Estructura (que exige rol ADMIN/SUPER_ADMIN) haría loop: Estructura lo rebotaría de
// vuelta aquí.
export default async function AdminIndex() {
  const ctx = await requerirFuncionario()
  if (ROLES_ADMIN_TENANT.includes(ctx.sesion.rol)) redirect("/admin/estructura")

  const visibles = new Set(await modulosVisibles(ctx, MODULOS.map((m) => m.id)))
  const primero = MODULOS.find((m) => m.ruta && visibles.has(m.id))
  if (primero) redirect(primero.ruta!)

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-slate-500">No tienes módulos asignados todavía. Contacta al administrador de tu entidad.</p>
    </main>
  )
}

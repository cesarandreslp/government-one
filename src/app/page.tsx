import { contextoTenant } from "@/lib/contexto-tenant"
import { LandingPlataforma } from "./landing-plataforma"
import { PortalTenant } from "./portal-tenant"

// La raíz se ramifica por HOST: en el host de un tenant se sirve SU portal público (con sus
// datos); en el host de plataforma (government-one.vercel.app), la landing corporativa del SaaS.
export const dynamic = "force-dynamic"

export default async function Home() {
  const ctx = await contextoTenant()
  if (ctx) {
    const dependencias = await ctx.db.dependencia.findMany({
      where: { activa: true },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, nombre: true, tipo: true, padreId: true },
    })
    return <PortalTenant nombre={ctx.tenant.nombre} dependencias={dependencias} />
  }
  return <LandingPlataforma />
}

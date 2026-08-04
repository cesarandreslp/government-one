"use server"

import { revalidatePath } from "next/cache"
import { requerirContratista } from "@/lib/dal-contratista"
import { obtenerSecretoTenant } from "@/lib/tenant-secretos"
import { redactarInformeActividad } from "@/lib/ia/redactar-informe"

// Acciones del PORTAL DEL CONTRATISTA. Toda acción verifica que el contrato/informe pertenezca al
// `terceroId` de la sesión — la identidad, no una capacidad, es el control de acceso aquí (el
// contratista no tiene cargo).

export interface CtState {
  ok?: boolean
  error?: string
  mensaje?: string
}

async function contratoEsMio(db: Awaited<ReturnType<typeof requerirContratista>>["db"], contratoId: string, terceroId: string) {
  const c = await db.contrato.findUnique({ where: { id: contratoId }, select: { terceroId: true } })
  return c?.terceroId === terceroId
}

export async function crearInformeAction(_prev: CtState, formData: FormData): Promise<CtState> {
  const ctx = await requerirContratista()
  const contratoId = String(formData.get("contratoId") ?? "").trim()
  const periodo = String(formData.get("periodo") ?? "").trim()
  if (!contratoId || !periodo) return { ok: false, error: "Contrato y período son obligatorios." }
  if (!(await contratoEsMio(ctx.db, contratoId, ctx.terceroId))) return { ok: false, error: "Ese contrato no es tuyo." }

  const abierto = await ctx.db.informeSupervision.findFirst({ where: { contratoId, estado: { in: ["BORRADOR", "DEVUELTO"] } } })
  if (abierto) return { ok: false, error: "Ya tienes un informe abierto (BORRADOR/DEVUELTO) para este contrato — complétalo o corrígelo antes de crear otro." }

  try {
    const ultimo = await ctx.db.informeSupervision.findFirst({ where: { contratoId }, orderBy: { numero: "desc" } })
    await ctx.db.informeSupervision.create({ data: { contratoId, numero: (ultimo?.numero ?? 0) + 1, periodo } })
    revalidatePath("/contratista")
    return { ok: true, mensaje: `Informe del período "${periodo}" creado.` }
  } catch {
    return { ok: false, error: "Error al crear el informe." }
  }
}

export async function guardarActividadReporteAction(_prev: CtState, formData: FormData): Promise<CtState> {
  const ctx = await requerirContratista()
  const informeId = String(formData.get("informeId") ?? "").trim()
  const actividadId = String(formData.get("actividadId") ?? "").trim()
  const descripcionContratista = String(formData.get("descripcionContratista") ?? "").trim()
  const evidenciaUrl = String(formData.get("evidenciaUrl") ?? "").trim() || null
  if (!informeId || !actividadId || !descripcionContratista) return { ok: false, error: "Actividad y descripción son obligatorias." }
  if (descripcionContratista.length < 15) return { ok: false, error: "Describe con un poco más de detalle qué hiciste (mínimo 15 caracteres)." }

  const informe = await ctx.db.informeSupervision.findUnique({ where: { id: informeId }, include: { contrato: true } })
  if (!informe || informe.contrato.terceroId !== ctx.terceroId) return { ok: false, error: "Ese informe no es tuyo." }
  if (informe.estado !== "BORRADOR" && informe.estado !== "DEVUELTO") return { ok: false, error: "Solo puedes editar un informe en BORRADOR o DEVUELTO." }

  const actividad = await ctx.db.contratoActividad.findUnique({ where: { id: actividadId } })
  if (!actividad || actividad.contratoId !== informe.contratoId) return { ok: false, error: "Actividad inválida para este contrato." }

  const credencial = await obtenerSecretoTenant(ctx.tenant.id, "ia")
  if (!credencial) return { ok: false, error: "La entidad no tiene configurada su credencial de IA — no se puede redactar el informe. Contacta al administrador." }
  const textoIA = await redactarInformeActividad(actividad.descripcion, descripcionContratista, credencial)
  if (!textoIA) return { ok: false, error: "La IA no pudo redactar el informe — intenta de nuevo en un momento." }

  try {
    await ctx.db.actividadReporte.upsert({
      where: { informeId_actividadId: { informeId, actividadId } },
      create: { informeId, actividadId, descripcionContratista, evidenciaUrl, textoIA },
      update: { descripcionContratista, evidenciaUrl, textoIA },
    })
    revalidatePath("/contratista")
    return { ok: true, mensaje: `Informe de "${actividad.descripcion}" redactado.` }
  } catch {
    return { ok: false, error: "Error al guardar el reporte de actividad." }
  }
}

export async function enviarInformeAction(_prev: CtState, formData: FormData): Promise<CtState> {
  const ctx = await requerirContratista()
  const informeId = String(formData.get("informeId") ?? "").trim()
  if (!informeId) return { ok: false, error: "Selecciona un informe." }

  const informe = await ctx.db.informeSupervision.findUnique({
    where: { id: informeId },
    include: { contrato: { include: { actividades: { where: { activa: true } } } }, actividades: true },
  })
  if (!informe || informe.contrato.terceroId !== ctx.terceroId) return { ok: false, error: "Ese informe no es tuyo." }
  if (informe.estado !== "BORRADOR" && informe.estado !== "DEVUELTO") return { ok: false, error: "Este informe ya fue enviado." }

  const reportadas = new Set(informe.actividades.filter((a) => a.textoIA).map((a) => a.actividadId))
  const faltantes = informe.contrato.actividades.filter((a) => !reportadas.has(a.id))
  if (faltantes.length > 0) return { ok: false, error: `Faltan actividades por reportar: ${faltantes.map((a) => a.descripcion).join(", ")}.` }

  try {
    await ctx.db.informeSupervision.update({ where: { id: informeId }, data: { estado: "ENVIADO" } })
    revalidatePath("/contratista")
    return { ok: true, mensaje: "Informe enviado al supervisor." }
  } catch {
    return { ok: false, error: "Error al enviar el informe." }
  }
}

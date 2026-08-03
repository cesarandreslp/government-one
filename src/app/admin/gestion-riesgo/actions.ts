"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Gestión del Riesgo de Desastres (CMGRD, Ley 1523/2012): registro AGREGADO de emergencias
// atendidas (cifras de afectación, no nominal) + ayudas entregadas (insert-only, trazabilidad).

const MODULO = "gestion_riesgo"
const TIPOS_EVENTO = ["INUNDACION", "DESLIZAMIENTO", "INCENDIO_FORESTAL", "INCENDIO_ESTRUCTURAL", "VENDAVAL", "SISMO", "SEQUIA", "OTRO"]

export interface GrdState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearEmergenciaAction(_prev: GrdState, formData: FormData): Promise<GrdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Gestión del Riesgo." }

  const tipoEvento = String(formData.get("tipoEvento") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const ubicacion = String(formData.get("ubicacion") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null
  const familiasAfectadas = Number.parseInt(String(formData.get("familiasAfectadas") ?? "0"), 10) || 0
  const personasAfectadas = Number.parseInt(String(formData.get("personasAfectadas") ?? "0"), 10) || 0

  if (!TIPOS_EVENTO.includes(tipoEvento)) return { ok: false, error: "Tipo de evento inválido." }
  if (!fecha || !ubicacion) return { ok: false, error: "Fecha y ubicación son obligatorias." }
  if (familiasAfectadas < 0 || personasAfectadas < 0) return { ok: false, error: "Las cifras de afectación no pueden ser negativas." }

  const vigencia = new Date(fecha).getUTCFullYear()

  try {
    const emergencia = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.emergenciaGrdConsecutivo.upsert({
        where: { vigencia }, create: { vigencia, ultimo: 1 }, update: { ultimo: { increment: 1 } },
      })
      const numero = `EMG-${vigencia}-${String(cons.ultimo).padStart(3, "0")}`
      return tx.emergenciaGrd.create({
        data: {
          numero, tipoEvento: tipoEvento as never, fecha: new Date(fecha), ubicacion, descripcion,
          familiasAfectadas, personasAfectadas, registradoPor: ctx.sesion.usuarioId,
        },
      })
    })
    revalidatePath("/admin/gestion-riesgo")
    return { ok: true, mensaje: `Emergencia ${emergencia.numero} registrada.` }
  } catch {
    return { ok: false, error: "Error al registrar la emergencia." }
  }
}

export async function registrarAyudaAction(_prev: GrdState, formData: FormData): Promise<GrdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Gestión del Riesgo." }

  const emergenciaId = String(formData.get("emergenciaId") ?? "").trim()
  const tipoAyuda = String(formData.get("tipoAyuda") ?? "").trim()
  const cantidad = String(formData.get("cantidad") ?? "").trim()
  const fechaEntrega = String(formData.get("fechaEntrega") ?? "").trim()

  if (!emergenciaId || !tipoAyuda || !cantidad || !fechaEntrega) return { ok: false, error: "Todos los campos son obligatorios." }

  try {
    await ctx.db.emergenciaAyudaGrd.create({
      data: { emergenciaId, tipoAyuda, cantidad, fechaEntrega: new Date(fechaEntrega), entregadoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/gestion-riesgo")
    return { ok: true, mensaje: "Ayuda registrada." }
  } catch {
    return { ok: false, error: "Error al registrar la ayuda (¿emergencia válida?)." }
  }
}

export async function cerrarEmergenciaAction(_prev: GrdState, formData: FormData): Promise<GrdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Gestión del Riesgo." }

  const emergenciaId = String(formData.get("emergenciaId") ?? "").trim()
  if (!emergenciaId) return { ok: false, error: "Selecciona una emergencia." }

  try {
    const emergencia = await ctx.db.emergenciaGrd.update({ where: { id: emergenciaId }, data: { estado: "CERRADA" } })
    revalidatePath("/admin/gestion-riesgo")
    return { ok: true, mensaje: `Emergencia ${emergencia.numero} cerrada.` }
  } catch {
    return { ok: false, error: "Error al cerrar la emergencia." }
  }
}

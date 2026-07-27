"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { sumarDiasHabiles } from "@/lib/dias-habiles"

// Ordenamiento Territorial (Ley 388/1997, Decreto 1077/2015 — municipios sin curaduría urbana
// expiden directamente estos trámites desde la Secretaría de Planeación). Gateada por capacidad
// `ordenamiento_territorial` (consultar/tramitar). Términos por tipo de trámite, simplificación
// declarada en el schema: aproximación por tipo, sin modelar suspensión de términos.

const MODULO = "ordenamiento_territorial"
const ESTADOS = ["RADICADA", "EN_REVISION", "REQUIERE_AJUSTES", "APROBADA", "NEGADA"]

const DIAS_HABILES_POR_TIPO: Record<string, number> = {
  CONCEPTO_USO_SUELO: 15,
  LINEA_PARAMENTO: 15,
  LICENCIA_CONSTRUCCION: 45,
  LICENCIA_URBANIZACION: 45,
  LICENCIA_SUBDIVISION: 45,
}

export interface OrdState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function radicarSolicitudAction(_prev: OrdState, formData: FormData): Promise<OrdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "tramitar"))) return { ok: false, error: "No tienes la capacidad para radicar solicitudes." }

  const tipo = String(formData.get("tipo") ?? "").trim()
  const solicitanteId = String(formData.get("solicitanteId") ?? "").trim()
  const predioId = String(formData.get("predioId") ?? "").trim()
  const direccion = String(formData.get("direccion") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()

  if (!tipo || !solicitanteId || !direccion || !descripcion) return { ok: false, error: "Todos los campos son obligatorios." }
  if (!(tipo in DIAS_HABILES_POR_TIPO)) return { ok: false, error: "Tipo de trámite inválido." }

  const ahora = new Date()
  const anio = ahora.getUTCFullYear()
  const vencimiento = sumarDiasHabiles(ahora, DIAS_HABILES_POR_TIPO[tipo])

  try {
    const solicitud = await ctx.db.$transaction(async (tx) => {
      const cons = await tx.urbanisticoConsecutivo.upsert({
        where: { anio }, create: { anio, ultimo: 1 }, update: { ultimo: { increment: 1 } },
      })
      const numero = `URB-${anio}-${String(cons.ultimo).padStart(6, "0")}`
      return tx.solicitudUrbanistica.create({
        data: {
          numero, tipo: tipo as never, solicitanteId, predioId: predioId || null, direccion, descripcion,
          fechaRadicacion: ahora, fechaVencimiento: vencimiento, creadoPor: ctx.sesion.usuarioId,
          actuaciones: { create: [{ fecha: ahora, descripcion: "Radicación de la solicitud.", registradoPor: ctx.sesion.usuarioId }] },
        },
      })
    })
    revalidatePath("/admin/ordenamiento")
    return { ok: true, mensaje: `${solicitud.numero} radicada. Vence ${vencimiento.toISOString().slice(0, 10)}.` }
  } catch {
    return { ok: false, error: "Error al radicar la solicitud." }
  }
}

export async function registrarActuacionAction(_prev: OrdState, formData: FormData): Promise<OrdState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "tramitar"))) return { ok: false, error: "No tienes la capacidad para tramitar solicitudes." }

  const solicitudId = String(formData.get("solicitudId") ?? "").trim()
  const estado = String(formData.get("estado") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()

  if (!solicitudId || !estado || !fecha || !descripcion) return { ok: false, error: "Todos los campos son obligatorios." }
  if (!ESTADOS.includes(estado)) return { ok: false, error: "Estado inválido." }

  const solicitud = await ctx.db.solicitudUrbanistica.findUnique({ where: { id: solicitudId } })
  if (!solicitud) return { ok: false, error: "Solicitud no encontrada." }
  if (solicitud.estado === "APROBADA" || solicitud.estado === "NEGADA") return { ok: false, error: `Esta solicitud ya está ${solicitud.estado}.` }

  const esRespuestaFinal = estado === "APROBADA" || estado === "NEGADA"

  try {
    await ctx.db.$transaction(async (tx) => {
      await tx.solicitudUrbanisticaActuacion.create({ data: { solicitudId, fecha: new Date(fecha), descripcion, registradoPor: ctx.sesion.usuarioId } })
      await tx.solicitudUrbanistica.update({
        where: { id: solicitudId },
        data: {
          estado: estado as never,
          ...(esRespuestaFinal ? { concepto: descripcion, fechaRespuesta: new Date(fecha), respondidoPorId: ctx.sesion.usuarioId } : {}),
        },
      })
    })
    revalidatePath("/admin/ordenamiento")
    return { ok: true, mensaje: "Actuación registrada." }
  } catch {
    return { ok: false, error: "Error al registrar la actuación." }
  }
}

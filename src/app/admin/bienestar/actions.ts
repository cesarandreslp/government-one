"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

const MODULO = "bienestar"

export interface BienestarState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearActividadAction(_prev: BienestarState, formData: FormData): Promise<BienestarState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Bienestar Social." }

  const nombre = String(formData.get("nombre") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null

  if (!nombre || !tipo || !fecha) return { ok: false, error: "Nombre, tipo y fecha son obligatorios." }
  if (!["DEPORTIVA", "CULTURAL", "INTEGRACION", "RECONOCIMIENTO"].includes(tipo)) return { ok: false, error: "Tipo inválido." }

  try {
    await ctx.db.actividadBienestar.create({ data: { nombre, tipo: tipo as never, fecha: new Date(fecha), descripcion, creadoPor: ctx.sesion.usuarioId } })
    revalidatePath("/admin/bienestar")
    return { ok: true, mensaje: `"${nombre}" registrada.` }
  } catch {
    return { ok: false, error: "Error al registrar la actividad." }
  }
}

export async function inscribirParticipanteAction(_prev: BienestarState, formData: FormData): Promise<BienestarState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Bienestar Social." }

  const actividadId = String(formData.get("actividadId") ?? "").trim()
  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  if (!actividadId || !usuarioId) return { ok: false, error: "Actividad y funcionario son obligatorios." }

  try {
    await ctx.db.bienestarParticipante.create({ data: { actividadId, usuarioId } })
    revalidatePath("/admin/bienestar")
    return { ok: true, mensaje: "Participante agregado." }
  } catch {
    return { ok: false, error: "Error al agregar (¿ya estaba inscrito?)." }
  }
}

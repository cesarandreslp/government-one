"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Convivencia y Seguridad Ciudadana: seguimiento al Consejo de Seguridad y al PISCC. Sesión
// (acta) + acuerdos que salen de ella, con su estado de cumplimiento — no es un expediente,
// es coordinación interinstitucional (el acuerdo es mutable, se marca cumplido).

const MODULO = "convivencia_seguridad"

export interface ConvivState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearSesionAction(_prev: ConvivState, formData: FormData): Promise<ConvivState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Convivencia y Seguridad." }

  const fecha = String(formData.get("fecha") ?? "").trim()
  const tema = String(formData.get("tema") ?? "").trim()
  const resumen = String(formData.get("resumen") ?? "").trim() || null

  if (!fecha || !tema) return { ok: false, error: "Fecha y tema son obligatorios." }

  try {
    await ctx.db.sesionConsejoSeguridad.create({
      data: { fecha: new Date(fecha), tema, resumen, registradoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/convivencia-seguridad")
    return { ok: true, mensaje: "Sesión registrada." }
  } catch {
    return { ok: false, error: "Error al registrar la sesión." }
  }
}

export async function crearAcuerdoAction(_prev: ConvivState, formData: FormData): Promise<ConvivState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Convivencia y Seguridad." }

  const sesionId = String(formData.get("sesionId") ?? "").trim()
  const descripcion = String(formData.get("descripcion") ?? "").trim()
  const responsable = String(formData.get("responsable") ?? "").trim()
  const plazoRaw = String(formData.get("plazo") ?? "").trim()
  const plazo = plazoRaw ? new Date(plazoRaw) : null

  if (!sesionId || !descripcion || !responsable) return { ok: false, error: "Sesión, descripción y responsable son obligatorios." }

  try {
    await ctx.db.acuerdoConsejoSeguridad.create({ data: { sesionId, descripcion, responsable, plazo } })
    revalidatePath("/admin/convivencia-seguridad")
    return { ok: true, mensaje: "Acuerdo registrado." }
  } catch {
    return { ok: false, error: "Error al registrar el acuerdo (¿sesión válida?)." }
  }
}

export async function marcarAcuerdoCumplidoAction(_prev: ConvivState, formData: FormData): Promise<ConvivState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Convivencia y Seguridad." }

  const acuerdoId = String(formData.get("acuerdoId") ?? "").trim()
  if (!acuerdoId) return { ok: false, error: "Selecciona un acuerdo." }

  try {
    await ctx.db.acuerdoConsejoSeguridad.update({ where: { id: acuerdoId }, data: { estado: "CUMPLIDO" } })
    revalidatePath("/admin/convivencia-seguridad")
    return { ok: true, mensaje: "Acuerdo marcado como cumplido." }
  } catch {
    return { ok: false, error: "Error al actualizar el acuerdo." }
  }
}

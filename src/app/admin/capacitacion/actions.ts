"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

const MODULO = "capacitacion"

export interface CapacitacionState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearCapacitacionAction(_prev: CapacitacionState, formData: FormData): Promise<CapacitacionState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Capacitación." }

  const nombre = String(formData.get("nombre") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const fechaInicio = String(formData.get("fechaInicio") ?? "").trim()
  const fechaFin = String(formData.get("fechaFin") ?? "").trim()
  const horas = formData.get("horas") ? Number(formData.get("horas")) : null
  const entidadCapacitadora = String(formData.get("entidadCapacitadora") ?? "").trim() || null

  if (!nombre || !tipo || !fechaInicio || !fechaFin) return { ok: false, error: "Nombre, tipo y fechas son obligatorios." }
  if (!["CURSO", "DIPLOMADO", "INDUCCION", "REINDUCCION"].includes(tipo)) return { ok: false, error: "Tipo inválido." }
  if (new Date(fechaFin) < new Date(fechaInicio)) return { ok: false, error: "La fecha fin no puede ser anterior a la fecha inicio." }

  try {
    await ctx.db.capacitacion.create({
      data: { nombre, tipo: tipo as never, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin), horas, entidadCapacitadora, creadoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/capacitacion")
    return { ok: true, mensaje: `"${nombre}" registrada.` }
  } catch {
    return { ok: false, error: "Error al registrar la capacitación." }
  }
}

export async function inscribirAction(_prev: CapacitacionState, formData: FormData): Promise<CapacitacionState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Capacitación." }

  const capacitacionId = String(formData.get("capacitacionId") ?? "").trim()
  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  if (!capacitacionId || !usuarioId) return { ok: false, error: "Capacitación y funcionario son obligatorios." }

  try {
    await ctx.db.capacitacionInscripcion.create({ data: { capacitacionId, usuarioId } })
    revalidatePath("/admin/capacitacion")
    return { ok: true, mensaje: "Funcionario inscrito." }
  } catch {
    return { ok: false, error: "Error al inscribir (¿ya estaba inscrito?)." }
  }
}

export async function marcarAsistenciaAction(_prev: CapacitacionState, formData: FormData): Promise<CapacitacionState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Capacitación." }

  const inscripcionId = String(formData.get("inscripcionId") ?? "").trim()
  if (!inscripcionId) return { ok: false, error: "Falta la inscripción." }

  try {
    await ctx.db.capacitacionInscripcion.update({ where: { id: inscripcionId }, data: { asistio: true } })
    revalidatePath("/admin/capacitacion")
    return { ok: true, mensaje: "Asistencia registrada." }
  } catch {
    return { ok: false, error: "Error al registrar la asistencia." }
  }
}

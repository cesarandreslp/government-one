"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

const MODULO = "relaciones_laborales"

export interface RelLabState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function registrarPermisoAction(_prev: RelLabState, formData: FormData): Promise<RelLabState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Relaciones Laborales." }

  const usuarioId = String(formData.get("usuarioId") ?? "").trim()
  const fechaInicio = String(formData.get("fechaInicio") ?? "").trim()
  const fechaFin = String(formData.get("fechaFin") ?? "").trim()
  const motivo = String(formData.get("motivo") ?? "").trim()

  if (!usuarioId || !fechaInicio || !fechaFin || !motivo) return { ok: false, error: "Todos los campos son obligatorios." }
  if (new Date(fechaFin) < new Date(fechaInicio)) return { ok: false, error: "La fecha fin no puede ser anterior a la fecha inicio." }

  try {
    await ctx.db.permisoSindical.create({
      data: { usuarioId, fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin), motivo, creadoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/relaciones-laborales")
    return { ok: true, mensaje: "Permiso sindical registrado." }
  } catch {
    return { ok: false, error: "Error al registrar el permiso." }
  }
}

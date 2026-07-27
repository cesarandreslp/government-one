"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Estratificación socioeconómica (Ley 142/1994). REUSA RentaPredio.estrato (ya existente en
// Rentas) — este módulo solo agrega el flujo de actualización AUDITADA (motivo + historial
// insert-only) y el certificado, nunca duplica el registro del predio.

const MODULO = "estratificacion"

export interface EstratState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function actualizarEstratoAction(_prev: EstratState, formData: FormData): Promise<EstratState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "actualizar"))) return { ok: false, error: "No tienes la capacidad para actualizar estratificación." }

  const predioId = String(formData.get("predioId") ?? "").trim()
  const estratoNuevo = Number(formData.get("estratoNuevo"))
  const motivo = String(formData.get("motivo") ?? "").trim()
  const fecha = String(formData.get("fecha") ?? "").trim()

  if (!predioId || !motivo || !fecha) return { ok: false, error: "Predio, motivo y fecha son obligatorios." }
  if (!Number.isInteger(estratoNuevo) || estratoNuevo < 1 || estratoNuevo > 6) return { ok: false, error: "El estrato debe ser un entero entre 1 y 6." }

  const predio = await ctx.db.rentaPredio.findUnique({ where: { id: predioId } })
  if (!predio) return { ok: false, error: "Predio no encontrado." }

  try {
    await ctx.db.$transaction(async (tx) => {
      await tx.estratificacionCambio.create({
        data: { predioId, estratoAnterior: predio.estrato, estratoNuevo, motivo, fecha: new Date(fecha), registradoPor: ctx.sesion.usuarioId },
      })
      await tx.rentaPredio.update({ where: { id: predioId }, data: { estrato: estratoNuevo } })
    })
    revalidatePath("/admin/estratificacion")
    return { ok: true, mensaje: `Predio ${predio.numeroPredial}: estrato ${predio.estrato ?? "sin registrar"} → ${estratoNuevo}.` }
  } catch {
    return { ok: false, error: "Error al actualizar el estrato." }
  }
}

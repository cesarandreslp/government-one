"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// SISBEN: registro LOCAL de la ficha de clasificación socioeconómica, REUSANDO `Tercero` (igual
// que Rentas/Ordenamiento). Simplificación declarada: el SISBEN real lo administra el DNP por
// encuesta + cargue periódico de archivos, no una API pública consultable en vivo — este módulo
// es el registro que Planeación mantiene localmente a partir de esos cargues.

const MODULO = "sisben"
const GRUPOS = ["A", "B", "C", "D"]

export interface SisbenState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function registrarFichaAction(_prev: SisbenState, formData: FormData): Promise<SisbenState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar SISBEN." }

  const personaId = String(formData.get("personaId") ?? "").trim()
  const ficha = String(formData.get("ficha") ?? "").trim()
  const grupo = String(formData.get("grupo") ?? "").trim()
  const puntajeRaw = String(formData.get("puntaje") ?? "").trim()
  const puntaje = puntajeRaw === "" ? null : Number(puntajeRaw)
  const fechaEncuesta = String(formData.get("fechaEncuesta") ?? "").trim()
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null

  if (!personaId || !ficha || !fechaEncuesta) return { ok: false, error: "Persona, ficha y fecha de encuesta son obligatorios." }
  if (!GRUPOS.includes(grupo)) return { ok: false, error: "Grupo SISBEN inválido." }
  if (puntajeRaw !== "" && (!Number.isFinite(puntaje) || (puntaje as number) < 0)) return { ok: false, error: "El puntaje debe ser ≥ 0." }

  try {
    const registro = await ctx.db.sisbenRegistro.create({
      data: { personaId, ficha, grupo: grupo as never, puntaje, fechaEncuesta: new Date(fechaEncuesta), observaciones, registradoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/sisben")
    return { ok: true, mensaje: `Ficha ${registro.ficha} registrada — grupo ${registro.grupo}.` }
  } catch {
    return { ok: false, error: "Error al registrar la ficha (¿número de ficha repetido?)." }
  }
}

export async function actualizarVigenciaAction(_prev: SisbenState, formData: FormData): Promise<SisbenState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar SISBEN." }

  const registroId = String(formData.get("registroId") ?? "").trim()
  const vigente = String(formData.get("vigente") ?? "") === "true"
  if (!registroId) return { ok: false, error: "Selecciona un registro." }

  try {
    const registro = await ctx.db.sisbenRegistro.update({ where: { id: registroId }, data: { vigente } })
    revalidatePath("/admin/sisben")
    return { ok: true, mensaje: `Ficha ${registro.ficha} marcada como ${vigente ? "VIGENTE" : "NO VIGENTE"}.` }
  } catch {
    return { ok: false, error: "Error al actualizar la vigencia." }
  }
}

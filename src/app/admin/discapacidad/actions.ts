"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Discapacidad: registro LOCAL de caracterización, REUSANDO `Tercero` (igual que SISBEN). El
// RLCPD real lo administra el Ministerio de Salud por valoración clínica, no una API pública
// consultable en vivo (Ley 1618/2013) — este es el registro que Bienestar Social mantiene.

const MODULO = "discapacidad"
const TIPOS = ["FISICA", "VISUAL", "AUDITIVA", "INTELECTUAL", "PSICOSOCIAL", "MULTIPLE", "OTRA"]
const TIPOS_DOC = ["CC", "CE", "NIT", "PASAPORTE"]

export interface DiscapState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearPersonaAction(_prev: DiscapState, formData: FormData): Promise<DiscapState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Discapacidad." }

  const documento = String(formData.get("documento") ?? "").trim()
  const tipoDocumento = String(formData.get("tipoDocumento") ?? "CC").trim()
  const razonSocial = String(formData.get("razonSocial") ?? "").trim()

  if (!documento || !razonSocial) return { ok: false, error: "Documento y nombre son obligatorios." }
  if (!TIPOS_DOC.includes(tipoDocumento)) return { ok: false, error: "Tipo de documento inválido." }

  try {
    await ctx.db.tercero.create({ data: { documento, tipoDocumento: tipoDocumento as never, razonSocial } })
    revalidatePath("/admin/discapacidad")
    return { ok: true, mensaje: `Persona "${razonSocial}" creada.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `Ya existe una persona con documento "${documento}".` : "Error al crear la persona."
    return { ok: false, error: msg }
  }
}

export async function registrarDiscapacidadAction(_prev: DiscapState, formData: FormData): Promise<DiscapState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Discapacidad." }

  const personaId = String(formData.get("personaId") ?? "").trim()
  const tipo = String(formData.get("tipo") ?? "").trim()
  const fechaRegistro = String(formData.get("fechaRegistro") ?? "").trim()
  const origen = String(formData.get("origen") ?? "").trim() || null
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null

  if (!personaId || !fechaRegistro) return { ok: false, error: "Persona y fecha de registro son obligatorias." }
  if (!TIPOS.includes(tipo)) return { ok: false, error: "Tipo de discapacidad inválido." }

  try {
    await ctx.db.registroDiscapacidad.create({
      data: { personaId, tipo: tipo as never, fechaRegistro: new Date(fechaRegistro), origen, observaciones, registradoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/discapacidad")
    return { ok: true, mensaje: "Registro de discapacidad creado." }
  } catch {
    return { ok: false, error: "Error al registrar (¿persona válida?)." }
  }
}

export async function actualizarVigenciaAction(_prev: DiscapState, formData: FormData): Promise<DiscapState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Discapacidad." }

  const registroId = String(formData.get("registroId") ?? "").trim()
  const vigente = String(formData.get("vigente") ?? "") === "true"
  if (!registroId) return { ok: false, error: "Selecciona un registro." }

  try {
    await ctx.db.registroDiscapacidad.update({ where: { id: registroId }, data: { vigente } })
    revalidatePath("/admin/discapacidad")
    return { ok: true, mensaje: `Registro marcado como ${vigente ? "VIGENTE" : "NO VIGENTE"}.` }
  } catch {
    return { ok: false, error: "Error al actualizar la vigencia." }
  }
}

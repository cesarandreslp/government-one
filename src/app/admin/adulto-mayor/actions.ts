"use server"

import { revalidatePath } from "next/cache"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

// Adulto Mayor: registro de beneficiarios de programas (Colombia Mayor, Centro Día/Centro de
// Bienestar del Anciano), REUSANDO `Tercero`. Colombia Mayor es un subsidio NACIONAL (Prosperidad
// Social) — el municipio hace la postulación/enlace local, no administra el pago.

const MODULO = "adulto_mayor"
const PROGRAMAS = ["COLOMBIA_MAYOR", "CENTRO_DIA", "CENTRO_BIENESTAR_ANCIANO", "OTRO"]
const ESTADOS = ["POSTULADO", "ACTIVO", "RETIRADO"]
const TIPOS_DOC = ["CC", "CE", "NIT", "PASAPORTE"]

export interface AmState {
  ok?: boolean
  error?: string
  mensaje?: string
}

export async function crearPersonaAction(_prev: AmState, formData: FormData): Promise<AmState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Adulto Mayor." }

  const documento = String(formData.get("documento") ?? "").trim()
  const tipoDocumento = String(formData.get("tipoDocumento") ?? "CC").trim()
  const razonSocial = String(formData.get("razonSocial") ?? "").trim()

  if (!documento || !razonSocial) return { ok: false, error: "Documento y nombre son obligatorios." }
  if (!TIPOS_DOC.includes(tipoDocumento)) return { ok: false, error: "Tipo de documento inválido." }

  try {
    await ctx.db.tercero.create({ data: { documento, tipoDocumento: tipoDocumento as never, razonSocial } })
    revalidatePath("/admin/adulto-mayor")
    return { ok: true, mensaje: `Persona "${razonSocial}" creada.` }
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? `Ya existe una persona con documento "${documento}".` : "Error al crear la persona."
    return { ok: false, error: msg }
  }
}

export async function registrarBeneficiarioAction(_prev: AmState, formData: FormData): Promise<AmState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Adulto Mayor." }

  const personaId = String(formData.get("personaId") ?? "").trim()
  const programa = String(formData.get("programa") ?? "").trim()
  const fechaIngreso = String(formData.get("fechaIngreso") ?? "").trim()
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null

  if (!personaId || !fechaIngreso) return { ok: false, error: "Persona y fecha de ingreso son obligatorias." }
  if (!PROGRAMAS.includes(programa)) return { ok: false, error: "Programa inválido." }

  try {
    await ctx.db.beneficiarioAdultoMayor.create({
      data: { personaId, programa: programa as never, fechaIngreso: new Date(fechaIngreso), observaciones, registradoPor: ctx.sesion.usuarioId },
    })
    revalidatePath("/admin/adulto-mayor")
    return { ok: true, mensaje: "Beneficiario registrado." }
  } catch {
    return { ok: false, error: "Error al registrar (¿persona válida?)." }
  }
}

export async function actualizarEstadoAction(_prev: AmState, formData: FormData): Promise<AmState> {
  const ctx = await requerirFuncionario()
  if (!(await funcionarioPuede(ctx, MODULO, "administrar"))) return { ok: false, error: "No tienes la capacidad para administrar Adulto Mayor." }

  const beneficiarioId = String(formData.get("beneficiarioId") ?? "").trim()
  const estado = String(formData.get("estado") ?? "").trim()
  if (!beneficiarioId) return { ok: false, error: "Selecciona un beneficiario." }
  if (!ESTADOS.includes(estado)) return { ok: false, error: "Estado inválido." }

  try {
    await ctx.db.beneficiarioAdultoMayor.update({ where: { id: beneficiarioId }, data: { estado: estado as never } })
    revalidatePath("/admin/adulto-mayor")
    return { ok: true, mensaje: `Beneficiario marcado como ${estado}.` }
  } catch {
    return { ok: false, error: "Error al actualizar el estado." }
  }
}
